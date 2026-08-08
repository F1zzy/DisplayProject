package netstats

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestParseProcNetDev(t *testing.T) {
	sample := strings.Join([]string{
		"Inter-|   Receive                                                |  Transmit",
		" face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
		"    lo: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0",
		"  eth0: 5000 50 0 0 0 0 0 0 8000 80 0 0 0 0 0 0",
		"",
	}, "\n")

	ifaces := ParseProcNetDev(sample)
	if ifaces["lo"] != (Counters{RxBytes: 1000, TxBytes: 2000}) {
		t.Fatalf("lo=%+v", ifaces["lo"])
	}
	if ifaces["eth0"] != (Counters{RxBytes: 5000, TxBytes: 8000}) {
		t.Fatalf("eth0=%+v", ifaces["eth0"])
	}
}

func TestPickInterface(t *testing.T) {
	ifaces := map[string]Counters{
		"lo":    {1, 1},
		"wlan0": {2, 2},
		"eth0":  {3, 3},
	}
	if got := PickInterface(ifaces, ""); got != "eth0" {
		t.Fatalf("got %q", got)
	}
	if got := PickInterface(ifaces, "wlan0"); got != "wlan0" {
		t.Fatalf("got %q", got)
	}
	if got := PickInterface(map[string]Counters{"lo": {1, 1}}, ""); got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestComputeRates(t *testing.T) {
	prevAt := time.UnixMilli(1000)
	now := time.UnixMilli(3000)
	rx, tx := ComputeRates(Counters{RxBytes: 3000, TxBytes: 4000}, 1000, 2000, prevAt, now)
	if rx == nil || *rx != 1000 || tx == nil || *tx != 1000 {
		t.Fatalf("rx=%v tx=%v", rx, tx)
	}

	rx, tx = ComputeRates(Counters{RxBytes: 10, TxBytes: 10}, 0, 0, now, now)
	if rx != nil || tx != nil {
		t.Fatalf("expected nil rates for zero elapsed, got %v %v", rx, tx)
	}
}

func TestParseDefaultGateway(t *testing.T) {
	sample := strings.Join([]string{
		"Iface\tDestination\tGateway\tFlags\tRefCnt\tUse\tMetric\tMask\tMTU\tWindow\tIRTT",
		"eth0\t00000000\t0101A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0",
		"eth0\t0001A8C0\t00000000\t0001\t0\t0\t100\t00FFFFFF\t0\t0\t0",
	}, "\n")
	// 0101A8C0 little-endian → 192.168.1.1
	if got := ParseDefaultGateway(sample); got != "192.168.1.1" {
		t.Fatalf("got %q", got)
	}
	if got := ParseDefaultGateway("Iface\tDestination\tGateway\n"); got != "" {
		t.Fatalf("empty expected, got %q", got)
	}
}

func TestHexIPv4(t *testing.T) {
	got, err := hexIPv4("0101A8C0")
	if err != nil || got != "192.168.1.1" {
		t.Fatalf("got %q err=%v", got, err)
	}
}

func TestSummaryHistoryAndPublicIP(t *testing.T) {
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		switch {
		case strings.Contains(r.URL.Path, "generate_204"):
			w.WriteHeader(http.StatusNoContent)
		case strings.Contains(r.URL.RawQuery, "format=json") || strings.Contains(r.URL.Path, "ipify"):
			_ = json.NewEncoder(w).Encode(map[string]string{"ip": "203.0.113.10"})
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	defer srv.Close()

	now := time.Unix(1_700_000_000, 0)
	c := New(Options{
		ProbeURL:     srv.URL + "/generate_204",
		PublicIPURL:  srv.URL + "/?format=json",
		CacheTTL:     time.Millisecond,
		ProbeTimeout: time.Second,
		PublicIPTTL:  time.Hour,
		HistoryMax:   3,
		DialTimeout:  50 * time.Millisecond,
		HTTPClient:   srv.Client(),
		Now: func() time.Time {
			return now
		},
		ReadProc: func(path string) (string, error) {
			if strings.Contains(path, "route") {
				return "Iface\tDestination\tGateway\neth0\t00000000\t0101A8C0\t0003\t0\t0\t0\t00000000\t0\t0\t0\n", nil
			}
			return strings.Join([]string{
				"Inter-| Receive | Transmit",
				" face |bytes packets|bytes packets",
				"  eth0: 1000 1 0 0 0 0 0 0 2000 1 0 0 0 0 0 0",
			}, "\n"), nil
		},
		LookupIPv4: func(iface string) *string {
			if iface != "eth0" {
				return nil
			}
			s := "192.168.1.50"
			return &s
		},
	})

	ctx := context.Background()
	stats, err := c.Stats(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !stats.Online || stats.PublicIP == nil || *stats.PublicIP != "203.0.113.10" {
		t.Fatalf("stats=%+v", stats)
	}
	if stats.IPv4 == nil || *stats.IPv4 != "192.168.1.50" {
		t.Fatalf("ipv4=%v", stats.IPv4)
	}
	if stats.Gateway == nil || *stats.Gateway != "192.168.1.1" {
		t.Fatalf("gateway=%v", stats.Gateway)
	}

	now = now.Add(20 * time.Millisecond)
	_, _ = c.Stats(ctx)
	now = now.Add(20 * time.Millisecond)
	summary, err := c.Summary(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(summary.History) < 2 {
		t.Fatalf("history len=%d", len(summary.History))
	}
	if summary.WindowSamples != 3 {
		t.Fatalf("window=%d", summary.WindowSamples)
	}
	if len(summary.Targets) != 3 {
		t.Fatalf("targets=%+v", summary.Targets)
	}
	names := map[string]bool{}
	for _, tg := range summary.Targets {
		names[tg.Name] = true
	}
	for _, want := range []string{"internet", "gateway", "dns"} {
		if !names[want] {
			t.Fatalf("missing target %s", want)
		}
	}
}
