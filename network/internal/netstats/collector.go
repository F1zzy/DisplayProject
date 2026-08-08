package netstats

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	DefaultProbeURL      = "https://www.gstatic.com/generate_204"
	DefaultProcNetDev    = "/proc/net/dev"
	DefaultPublicIPURL   = "https://api.ipify.org?format=json"
	DefaultHistoryMax    = 12
	DefaultPublicIPTTL   = 10 * time.Minute
	DefaultDNSTargetHost = "1.1.1.1:443"
)

// Stats is the lean payload for GET /stats (kiosk widget).
type Stats struct {
	Online       bool    `json:"online"`
	LatencyMs    *int64  `json:"latencyMs"`
	CheckedAt    string  `json:"checkedAt"`
	LastOnlineAt *string `json:"lastOnlineAt"`
	Interface    *string `json:"interface"`
	IPv4         *string `json:"ipv4"`
	Gateway      *string `json:"gateway"`
	PublicIP     *string `json:"publicIp"`
	RxBps        *int64  `json:"rxBps"`
	TxBps        *int64  `json:"txBps"`
}

// TargetLatency is one multi-target probe result.
type TargetLatency struct {
	Name      string `json:"name"`
	LatencyMs *int64 `json:"latencyMs"`
}

// HistoryPoint is one ring-buffer sample for charts.
type HistoryPoint struct {
	At        string `json:"at"`
	RxBps     *int64 `json:"rxBps"`
	TxBps     *int64 `json:"txBps"`
	LatencyMs *int64 `json:"latencyMs"`
}

// Summary is the richer payload for GET /summary (remote panel).
type Summary struct {
	Stats
	Targets       []TargetLatency `json:"targets"`
	History       []HistoryPoint  `json:"history"`
	WindowSamples int             `json:"windowSamples"`
}

type Counters struct {
	RxBytes int64
	TxBytes int64
}

type Options struct {
	ProbeURL      string
	Iface         string
	ProcNetDev    string
	ProcNetRoute  string
	PublicIPURL   string
	DNSTarget     string
	CacheTTL      time.Duration
	ProbeTimeout  time.Duration
	PublicIPTTL   time.Duration
	HistoryMax    int
	HTTPClient    *http.Client
	ReadProc      func(path string) (string, error)
	Now           func() time.Time
	DialTimeout   time.Duration
	LookupIPv4    func(iface string) *string
	LookupGateway func() *string
}

type previousSample struct {
	iface   string
	rxBytes int64
	txBytes int64
	at      time.Time
}

type Collector struct {
	opts Options

	mu             sync.Mutex
	cached         *Stats
	cachedUntil    time.Time
	lastOnline     *string
	previous       *previousSample
	history        []HistoryPoint
	publicIP       *string
	publicIPUntil  time.Time
	lastTargets    []TargetLatency
}

func New(opts Options) *Collector {
	if opts.ProbeURL == "" {
		opts.ProbeURL = DefaultProbeURL
	}
	if opts.ProcNetDev == "" {
		opts.ProcNetDev = DefaultProcNetDev
	}
	if opts.ProcNetRoute == "" {
		opts.ProcNetRoute = "/proc/net/route"
	}
	if opts.PublicIPURL == "" {
		opts.PublicIPURL = DefaultPublicIPURL
	}
	if opts.DNSTarget == "" {
		opts.DNSTarget = DefaultDNSTargetHost
	}
	if opts.CacheTTL <= 0 {
		opts.CacheTTL = 15 * time.Second
	}
	if opts.ProbeTimeout <= 0 {
		opts.ProbeTimeout = 2 * time.Second
	}
	if opts.PublicIPTTL <= 0 {
		opts.PublicIPTTL = DefaultPublicIPTTL
	}
	if opts.HistoryMax <= 0 {
		opts.HistoryMax = DefaultHistoryMax
	}
	if opts.DialTimeout <= 0 {
		opts.DialTimeout = 1500 * time.Millisecond
	}
	if opts.HTTPClient == nil {
		opts.HTTPClient = &http.Client{
			Timeout: opts.ProbeTimeout,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	if opts.ReadProc == nil {
		opts.ReadProc = func(path string) (string, error) {
			b, err := os.ReadFile(path)
			if err != nil {
				return "", err
			}
			return string(b), nil
		}
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.LookupIPv4 == nil {
		opts.LookupIPv4 = primaryIPv4
	}
	if opts.LookupGateway == nil {
		opts.LookupGateway = func() *string {
			content, err := opts.ReadProc(opts.ProcNetRoute)
			if err == nil {
				gw := ParseDefaultGateway(content)
				if gw != "" {
					return &gw
				}
			}
			return platformDefaultGateway()
		}
	}
	return &Collector{opts: opts, history: make([]HistoryPoint, 0, opts.HistoryMax)}
}

func (c *Collector) Stats(ctx context.Context) (Stats, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.statsLocked(ctx)
}

func (c *Collector) Summary(ctx context.Context) (Summary, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	stats, err := c.statsLocked(ctx)
	if err != nil {
		return Summary{}, err
	}

	targets := make([]TargetLatency, len(c.lastTargets))
	copy(targets, c.lastTargets)
	history := make([]HistoryPoint, len(c.history))
	copy(history, c.history)

	return Summary{
		Stats:         stats,
		Targets:       targets,
		History:       history,
		WindowSamples: c.opts.HistoryMax,
	}, nil
}

func (c *Collector) statsLocked(ctx context.Context) (Stats, error) {
	now := c.opts.Now()
	if c.cached != nil && now.Before(c.cachedUntil) {
		return *c.cached, nil
	}

	stats := c.collect(ctx, now)
	c.cached = &stats
	c.cachedUntil = now.Add(c.opts.CacheTTL)
	return stats, nil
}

func (c *Collector) collect(ctx context.Context, now time.Time) Stats {
	online, latency := c.probeHTTP(ctx, c.opts.ProbeURL)
	var lastOnline *string
	if online {
		iso := now.UTC().Format(time.RFC3339Nano)
		c.lastOnline = &iso
	}
	if c.lastOnline != nil {
		v := *c.lastOnline
		lastOnline = &v
	}

	iface, counters := c.readInterfaceCounters()
	var rates struct {
		rx *int64
		tx *int64
	}
	if counters != nil && c.previous != nil && c.previous.iface == deref(iface) {
		rates.rx, rates.tx = ComputeRates(*counters, c.previous.rxBytes, c.previous.txBytes, c.previous.at, now)
	}
	if counters != nil && iface != nil {
		c.previous = &previousSample{
			iface:   *iface,
			rxBytes: counters.RxBytes,
			txBytes: counters.TxBytes,
			at:      now,
		}
	}

	var latencyMs *int64
	if online {
		latencyMs = &latency
	}

	var ipv4 *string
	if iface != nil {
		ipv4 = c.opts.LookupIPv4(*iface)
	}
	gateway := c.opts.LookupGateway()
	publicIP := c.ensurePublicIP(ctx, now)

	targets := []TargetLatency{
		{Name: "internet", LatencyMs: latencyMs},
	}
	if gateway != nil {
		gwLat := c.probeTCP(ctx, net.JoinHostPort(*gateway, "80"))
		targets = append(targets, TargetLatency{Name: "gateway", LatencyMs: gwLat})
	} else {
		targets = append(targets, TargetLatency{Name: "gateway", LatencyMs: nil})
	}
	dnsLat := c.probeTCP(ctx, c.opts.DNSTarget)
	targets = append(targets, TargetLatency{Name: "dns", LatencyMs: dnsLat})
	c.lastTargets = targets

	checkedAt := now.UTC().Format(time.RFC3339Nano)
	c.appendHistory(HistoryPoint{
		At:        checkedAt,
		RxBps:     rates.rx,
		TxBps:     rates.tx,
		LatencyMs: latencyMs,
	})

	return Stats{
		Online:       online,
		LatencyMs:    latencyMs,
		CheckedAt:    checkedAt,
		LastOnlineAt: lastOnline,
		Interface:    iface,
		IPv4:         ipv4,
		Gateway:      gateway,
		PublicIP:     publicIP,
		RxBps:        rates.rx,
		TxBps:        rates.tx,
	}
}

func (c *Collector) appendHistory(point HistoryPoint) {
	c.history = append(c.history, point)
	if len(c.history) > c.opts.HistoryMax {
		c.history = c.history[len(c.history)-c.opts.HistoryMax:]
	}
}

func (c *Collector) ensurePublicIP(ctx context.Context, now time.Time) *string {
	if c.publicIP != nil && now.Before(c.publicIPUntil) {
		v := *c.publicIP
		return &v
	}
	ip := c.fetchPublicIP(ctx)
	if ip != nil {
		c.publicIP = ip
		c.publicIPUntil = now.Add(c.opts.PublicIPTTL)
		v := *ip
		return &v
	}
	if c.publicIP != nil {
		v := *c.publicIP
		return &v
	}
	return nil
}

func (c *Collector) fetchPublicIP(ctx context.Context) *string {
	reqCtx, cancel := context.WithTimeout(ctx, c.opts.ProbeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, c.opts.PublicIPURL, nil)
	if err != nil {
		return nil
	}
	resp, err := c.opts.HTTPClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return nil
	}
	trimmed := strings.TrimSpace(string(body))
	if strings.HasPrefix(trimmed, "{") {
		var payload struct {
			IP string `json:"ip"`
		}
		if err := json.Unmarshal(body, &payload); err == nil && payload.IP != "" {
			ip := payload.IP
			return &ip
		}
	}
	if trimmed != "" && net.ParseIP(trimmed) != nil {
		return &trimmed
	}
	return nil
}

func (c *Collector) probeHTTP(ctx context.Context, url string) (bool, int64) {
	reqCtx, cancel := context.WithTimeout(ctx, c.opts.ProbeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return false, 0
	}
	req.Header.Set("Cache-Control", "no-store")

	started := c.opts.Now()
	resp, err := c.opts.HTTPClient.Do(req)
	if err != nil {
		return false, 0
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 100 && resp.StatusCode < 600 {
		return true, c.opts.Now().Sub(started).Milliseconds()
	}
	return false, 0
}

func (c *Collector) probeTCP(ctx context.Context, address string) *int64 {
	d := net.Dialer{Timeout: c.opts.DialTimeout}
	started := c.opts.Now()
	conn, err := d.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil
	}
	_ = conn.Close()
	ms := c.opts.Now().Sub(started).Milliseconds()
	return &ms
}

func (c *Collector) readInterfaceCounters() (*string, *Counters) {
	content, err := c.opts.ReadProc(c.opts.ProcNetDev)
	if err == nil {
		ifaces := ParseProcNetDev(content)
		name := PickInterface(ifaces, c.opts.Iface)
		if name != "" {
			counters := ifaces[name]
			iface := name
			return &iface, &counters
		}
	}
	return samplePlatformCounters(c.opts.Iface)
}

// ParseProcNetDev parses /proc/net/dev into interface → counters.
func ParseProcNetDev(content string) map[string]Counters {
	out := make(map[string]Counters)
	lines := strings.Split(content, "\n")
	if len(lines) <= 2 {
		return out
	}
	for _, line := range lines[2:] {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		colon := strings.IndexByte(trimmed, ':')
		if colon == -1 {
			continue
		}
		name := strings.TrimSpace(trimmed[:colon])
		fields := strings.Fields(trimmed[colon+1:])
		if len(fields) < 9 {
			continue
		}
		out[name] = Counters{
			RxBytes: parseInt64(fields[0]),
			TxBytes: parseInt64(fields[8]),
		}
	}
	return out
}

// ParseDefaultGateway reads the default route destination 00000000 from /proc/net/route.
func ParseDefaultGateway(content string) string {
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if i == 0 {
			continue
		}
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 3 {
			continue
		}
		// Destination 00000000 = default route
		if fields[1] != "00000000" {
			continue
		}
		ip, err := hexIPv4(fields[2])
		if err != nil || ip == "0.0.0.0" {
			continue
		}
		return ip
	}
	return ""
}

func hexIPv4(hex string) (string, error) {
	if len(hex) != 8 {
		return "", fmt.Errorf("bad hex ip")
	}
	// Linux stores gateway as little-endian hex dword: AABBCCDD → DD.CC.BB.AA
	parts := make([]string, 4)
	for i := 0; i < 4; i++ {
		v, err := strconv.ParseUint(hex[i*2:i*2+2], 16, 8)
		if err != nil {
			return "", err
		}
		parts[3-i] = strconv.FormatUint(v, 10)
	}
	return strings.Join(parts, "."), nil
}

// PickInterface chooses a NIC, skipping lo.
func PickInterface(ifaces map[string]Counters, preferred string) string {
	if preferred != "" {
		if _, ok := ifaces[preferred]; ok {
			return preferred
		}
	}
	names := make([]string, 0, len(ifaces))
	for name := range ifaces {
		if name != "lo" {
			names = append(names, name)
		}
	}
	if len(names) == 0 {
		return ""
	}
	preferredOrder := []string{"eth0", "en0", "wlan0", "enp0s3", "ens33", "Ethernet", "Wi-Fi", "WiFi", "WLAN"}
	for _, name := range preferredOrder {
		if _, ok := ifaces[name]; ok {
			return name
		}
	}
	// Prefer common Windows/Linux wireless/ethernet substrings before alphabetical fallback.
	for _, name := range names {
		lower := strings.ToLower(name)
		if strings.Contains(lower, "wi-fi") || strings.Contains(lower, "wifi") || strings.Contains(lower, "wlan") || strings.Contains(lower, "ethernet") {
			return name
		}
	}
	sort.Strings(names)
	return names[0]
}

// ComputeRates returns bytes/sec between samples.
func ComputeRates(current Counters, prevRx, prevTx int64, prevAt, now time.Time) (rxBps, txBps *int64) {
	elapsed := now.Sub(prevAt).Seconds()
	if elapsed <= 0 {
		return nil, nil
	}
	rxDelta := current.RxBytes - prevRx
	txDelta := current.TxBytes - prevTx
	if rxDelta < 0 || txDelta < 0 {
		return nil, nil
	}
	rx := int64(float64(rxDelta) / elapsed)
	tx := int64(float64(txDelta) / elapsed)
	return &rx, &tx
}

func primaryIPv4(ifaceName string) *string {
	ifi, err := net.InterfaceByName(ifaceName)
	if err != nil {
		return nil
	}
	addrs, err := ifi.Addrs()
	if err != nil {
		return nil
	}
	for _, addr := range addrs {
		var ip net.IP
		switch v := addr.(type) {
		case *net.IPNet:
			ip = v.IP
		case *net.IPAddr:
			ip = v.IP
		}
		if ip == nil || ip.IsLoopback() {
			continue
		}
		ip4 := ip.To4()
		if ip4 == nil {
			continue
		}
		s := ip4.String()
		return &s
	}
	return nil
}

func parseInt64(s string) int64 {
	var n int64
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			break
		}
		n = n*10 + int64(ch-'0')
	}
	return n
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
