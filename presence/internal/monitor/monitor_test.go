package monitor

import "testing"

func TestTickSleepsAfterGraceThenWakes(t *testing.T) {
	reachable := false
	m := New(func(string) bool { return reachable }, func(string) bool { return false })
	m.SetConfig(Config{
		Enabled:     true,
		Host:        "10.255.255.50",
		IntervalMs:  15000,
		AwayAfterMs: 30000,
	})

	st := m.Tick()
	if st.Home == nil || *st.Home {
		t.Fatalf("first miss home=%v", st.Home)
	}
	if st.Away {
		t.Fatal("should not be away before grace")
	}

	st = m.Tick()
	if !st.Away {
		t.Fatal("expected away after grace")
	}

	reachable = true
	st = m.Tick()
	if st.Home == nil || !*st.Home || st.Away {
		t.Fatalf("expected home after success, got %+v", st)
	}
}

func TestTickDisabledAndEmptyHost(t *testing.T) {
	m := New(func(string) bool { return false }, func(string) bool { return false })
	m.SetConfig(Config{Enabled: false, Host: "10.255.255.50", IntervalMs: 15000, AwayAfterMs: 30000})
	st := m.Tick()
	if st.Enabled || st.Home != nil {
		t.Fatalf("disabled: %+v", st)
	}

	m.SetConfig(Config{Enabled: true, Host: "", IntervalMs: 15000, AwayAfterMs: 30000})
	st = m.Tick()
	if st.Enabled || st.Home != nil {
		t.Fatalf("empty host: %+v", st)
	}
}

func TestTickSkipsOwnAddress(t *testing.T) {
	probed := false
	m := New(func(string) bool {
		probed = true
		return true
	}, func(string) bool { return true })
	m.SetConfig(Config{Enabled: true, Host: "10.255.255.50", IntervalMs: 15000, AwayAfterMs: 30000})
	st := m.Tick()
	if probed {
		t.Fatal("should not probe own address")
	}
	if st.Home != nil {
		t.Fatalf("own address home=%v", st.Home)
	}
}

func TestSetConfigRejectsPublicIP(t *testing.T) {
	m := New(func(string) bool { return true }, func(string) bool { return false })
	m.SetConfig(Config{Enabled: true, Host: "8.8.8.8", IntervalMs: 15000, AwayAfterMs: 30000})
	st := m.Tick()
	if st.Enabled || st.Host != "" {
		t.Fatalf("public IP should be rejected: %+v", st)
	}
}

func TestSetConfigClampsInterval(t *testing.T) {
	m := New(func(string) bool { return true }, func(string) bool { return false })
	m.SetConfig(Config{Enabled: true, Host: "192.168.0.50", IntervalMs: 1000, AwayAfterMs: 1000})
	if got := m.Interval().Milliseconds(); got != 5000 {
		t.Fatalf("interval=%d", got)
	}
}
