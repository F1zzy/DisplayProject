package probe

import "testing"

func TestSanitizeHost(t *testing.T) {
	cases := map[string]string{
		"192.168.0.50":  "192.168.0.50",
		"10.0.0.1":      "10.0.0.1",
		"172.16.1.9":    "172.16.1.9",
		" 192.168.1.1 ": "192.168.1.1",
		"8.8.8.8":       "",
		"127.0.0.1":     "",
		"not-an-ip":     "",
		"":              "",
	}
	for in, want := range cases {
		if got := SanitizeHost(in); got != want {
			t.Errorf("SanitizeHost(%q)=%q want %q", in, got, want)
		}
	}
}

func TestPingLooksAlive(t *testing.T) {
	if !PingLooksAlive("Reply from 192.168.0.50: bytes=32 time=1ms TTL=64", nil, true) {
		t.Fatal("windows ttl should be alive")
	}
	if PingLooksAlive("Request timed out.", nil, true) {
		t.Fatal("windows timeout should be dead")
	}
	if !PingLooksAlive("", nil, false) {
		t.Fatal("unix ping ok should be alive")
	}
	if PingLooksAlive("", assertErr{}, false) {
		t.Fatal("unix ping error should be dead")
	}
}

type assertErr struct{}

func (assertErr) Error() string { return "exit 1" }

func TestArpLineLooksAlive(t *testing.T) {
	host := "192.168.0.50"
	if !ArpLineLooksAlive("192.168.0.50 dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE", host) {
		t.Fatal("REACHABLE")
	}
	if !ArpLineLooksAlive("192.168.0.50 dev wlan0 lladdr aa:bb:cc:dd:ee:ff STALE", host) {
		t.Fatal("STALE")
	}
	if ArpLineLooksAlive("192.168.0.50 dev wlan0 FAILED", host) {
		t.Fatal("FAILED should be dead")
	}
	if ArpLineLooksAlive("192.168.0.50 ff-ff-ff-ff-ff-ff", host) {
		t.Fatal("broadcast MAC should be dead")
	}
	if !ArpLineLooksAlive("  192.168.0.50           aa-bb-cc-dd-ee-ff     dynamic", host) {
		t.Fatal("windows arp -a unicast MAC")
	}
	if ArpLineLooksAlive("192.168.0.1 aa-bb-cc-dd-ee-ff", host) {
		t.Fatal("different host")
	}
}

func TestProcNetARPAlive(t *testing.T) {
	table := "IP address       HW type     Flags       HW address            Mask     Device\n" +
		"192.168.0.50     0x1         0x2         aa:bb:cc:dd:ee:ff     *        eth0\n" +
		"192.168.0.1      0x1         0x0         00:00:00:00:00:00     *        eth0\n"
	if !ProcNetARPAlive(table, "192.168.0.50") {
		t.Fatal("flag 0x2 should be alive")
	}
	if ProcNetARPAlive(table, "192.168.0.1") {
		t.Fatal("flag 0x0 should be dead")
	}
}
