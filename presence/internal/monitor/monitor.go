package monitor

import (
	"sync"
	"time"

	"github.com/displayproject/presence/internal/probe"
)

type Config struct {
	Enabled     bool
	Host        string
	IntervalMs  int
	AwayAfterMs int
}

type Status struct {
	Enabled bool   `json:"enabled"`
	Host    string `json:"host"`
	Home    *bool  `json:"home"`
	Away    bool   `json:"away"`
}

type ProbeFunc func(host string) bool
type OwnFunc func(host string) bool

type Monitor struct {
	mu       sync.Mutex
	cfg      Config
	probe    ProbeFunc
	own      OwnFunc
	missMs   int
	lastHost string
	home     *bool
	away     bool
}

func New(probeFn ProbeFunc, ownFn OwnFunc) *Monitor {
	if probeFn == nil {
		probeFn = probe.Default
	}
	if ownFn == nil {
		ownFn = probe.IsOwnAddress
	}
	return &Monitor{
		probe: probeFn,
		own:   ownFn,
		cfg: Config{
			IntervalMs:  15000,
			AwayAfterMs: 90000,
		},
	}
}

func clampInt(v, lo, hi, fallback int) int {
	if v == 0 {
		return fallback
	}
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func (m *Monitor) SetConfig(cfg Config) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cfg.Host = probe.SanitizeHost(cfg.Host)
	cfg.IntervalMs = clampInt(cfg.IntervalMs, 5000, 60000, 15000)
	cfg.AwayAfterMs = clampInt(cfg.AwayAfterMs, 30000, 600000, 90000)
	m.cfg = cfg
	m.missMs = 0
	m.home = nil
	m.away = false
	m.lastHost = ""
}

func (m *Monitor) Interval() time.Duration {
	m.mu.Lock()
	defer m.mu.Unlock()
	ms := m.cfg.IntervalMs
	if ms < 5000 {
		ms = 5000
	}
	return time.Duration(ms) * time.Millisecond
}

func (m *Monitor) Status() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.statusLocked()
}

func copyBool(p *bool) *bool {
	if p == nil {
		return nil
	}
	v := *p
	return &v
}

func (m *Monitor) statusLocked() Status {
	enabled := m.cfg.Enabled && m.cfg.Host != ""
	return Status{
		Enabled: enabled,
		Host:    m.cfg.Host,
		Home:    copyBool(m.home),
		Away:    m.away,
	}
}

func (m *Monitor) Tick() Status {
	m.mu.Lock()
	if !m.cfg.Enabled || m.cfg.Host == "" {
		m.missMs = 0
		m.home = nil
		m.away = false
		m.lastHost = ""
		st := m.statusLocked()
		m.mu.Unlock()
		return st
	}

	host := m.cfg.Host
	intervalMs := m.cfg.IntervalMs
	awayAfterMs := m.cfg.AwayAfterMs
	own := m.own
	probeFn := m.probe
	if host != m.lastHost {
		m.missMs = 0
		m.lastHost = host
	}
	m.mu.Unlock()

	if own != nil && own(host) {
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.cfg.Host == host {
			m.home = nil
			m.away = false
		}
		return m.statusLocked()
	}

	reachable := probeFn != nil && probeFn(host)

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cfg.Host != host {
		return m.statusLocked()
	}

	home := reachable
	m.home = &home
	if reachable {
		m.missMs = 0
		m.away = false
		return m.statusLocked()
	}

	m.missMs += intervalMs
	m.away = m.missMs >= awayAfterMs
	return m.statusLocked()
}
