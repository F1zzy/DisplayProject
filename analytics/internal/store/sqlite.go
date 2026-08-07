package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const windowHours = 24

type Event struct {
	Type         string `json:"type"`
	TS           string `json:"ts,omitempty"`
	Path         string `json:"path,omitempty"`
	Method       string `json:"method,omitempty"`
	Status       int    `json:"status,omitempty"`
	DurationMs   int64  `json:"duration_ms,omitempty"`
	WidgetKey    string `json:"widget_key,omitempty"`
	Source       string `json:"source,omitempty"`
	PowerAction  string `json:"power_action,omitempty"`
}

type MostViewedWidget struct {
	Key   string `json:"key"`
	Views int    `json:"views"`
}

type BusiestHour struct {
	Hour   int `json:"hour"`
	Events int `json:"events"`
}

type SlowestAPI struct {
	Path    string  `json:"path"`
	AvgMs   float64 `json:"avgMs"`
	Samples int     `json:"samples"`
}

type Totals struct {
	APICalls    int `json:"apiCalls"`
	WidgetViews int `json:"widgetViews"`
}

type Summary struct {
	MostViewedWidget *MostViewedWidget `json:"mostViewedWidget"`
	BusiestHour      *BusiestHour      `json:"busiestHour"`
	SlowestAPI       *SlowestAPI       `json:"slowestApi"`
	WidgetViews      []MostViewedWidget `json:"widgetViews"`
	EventsByHour     []BusiestHour      `json:"eventsByHour"`
	APILatency       []SlowestAPI       `json:"apiLatency"`
	WindowHours      int                `json:"windowHours"`
	Totals           Totals             `json:"totals"`
}

type Store struct {
	db *sql.DB
}

func Open(dbPath string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			ts TEXT NOT NULL,
			path TEXT,
			method TEXT,
			status INTEGER,
			duration_ms INTEGER,
			widget_key TEXT,
			source TEXT,
			power_action TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
		CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
	`)
	return err
}

func (s *Store) Insert(events []Event) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.Prepare(`
		INSERT INTO events (type, ts, path, method, status, duration_ms, widget_key, source, power_action)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC().Format(time.RFC3339Nano)
	for _, e := range events {
		ts := e.TS
		if ts == "" {
			ts = now
		}
		var status any
		if e.Status != 0 {
			status = e.Status
		}
		var duration any
		if e.DurationMs != 0 || e.Type == "api" {
			duration = e.DurationMs
		}
		if _, err := stmt.Exec(
			e.Type,
			ts,
			nullStr(e.Path),
			nullStr(e.Method),
			status,
			duration,
			nullStr(e.WidgetKey),
			nullStr(e.Source),
			nullStr(e.PowerAction),
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func nullStr(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func (s *Store) Summary() (Summary, error) {
	since := time.Now().UTC().Add(-windowHours * time.Hour).Format(time.RFC3339Nano)
	out := Summary{
		WindowHours:  windowHours,
		Totals:       Totals{},
		WidgetViews:  []MostViewedWidget{},
		EventsByHour: make([]BusiestHour, 24),
		APILatency:   []SlowestAPI{},
	}
	for h := 0; h < 24; h++ {
		out.EventsByHour[h] = BusiestHour{Hour: h, Events: 0}
	}

	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM events WHERE type = 'api' AND ts >= ?`, since,
	).Scan(&out.Totals.APICalls); err != nil {
		return out, err
	}
	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM events WHERE type = 'widget_view' AND ts >= ?`, since,
	).Scan(&out.Totals.WidgetViews); err != nil {
		return out, err
	}

	var key string
	var views int
	err := s.db.QueryRow(`
		SELECT widget_key, COUNT(*) AS c
		FROM events
		WHERE type = 'widget_view' AND ts >= ? AND widget_key IS NOT NULL AND widget_key != ''
		GROUP BY widget_key
		ORDER BY c DESC
		LIMIT 1
	`, since).Scan(&key, &views)
	if err == nil {
		out.MostViewedWidget = &MostViewedWidget{Key: key, Views: views}
	} else if err != sql.ErrNoRows {
		return out, err
	}

	var hour, events int
	err = s.db.QueryRow(`
		SELECT CAST(strftime('%H', ts) AS INTEGER) AS h, COUNT(*) AS c
		FROM events
		WHERE ts >= ?
		GROUP BY h
		ORDER BY c DESC
		LIMIT 1
	`, since).Scan(&hour, &events)
	if err == nil {
		out.BusiestHour = &BusiestHour{Hour: hour, Events: events}
	} else if err != sql.ErrNoRows {
		return out, err
	}

	var path string
	var avgMs float64
	var samples int
	err = s.db.QueryRow(`
		SELECT path, AVG(duration_ms) AS avg_ms, COUNT(*) AS c
		FROM events
		WHERE type = 'api' AND ts >= ? AND path IS NOT NULL AND path != '' AND duration_ms IS NOT NULL
		GROUP BY path
		HAVING c >= 1
		ORDER BY avg_ms DESC
		LIMIT 1
	`, since).Scan(&path, &avgMs, &samples)
	if err == nil {
		out.SlowestAPI = &SlowestAPI{Path: path, AvgMs: avgMs, Samples: samples}
	} else if err != sql.ErrNoRows {
		return out, err
	}

	rows, err := s.db.Query(`
		SELECT widget_key, COUNT(*) AS c
		FROM events
		WHERE type = 'widget_view' AND ts >= ? AND widget_key IS NOT NULL AND widget_key != ''
		GROUP BY widget_key
		ORDER BY c DESC
		LIMIT 8
	`, since)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item MostViewedWidget
		if err := rows.Scan(&item.Key, &item.Views); err != nil {
			return out, err
		}
		out.WidgetViews = append(out.WidgetViews, item)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}

	hourRows, err := s.db.Query(`
		SELECT CAST(strftime('%H', ts) AS INTEGER) AS h, COUNT(*) AS c
		FROM events
		WHERE ts >= ?
		GROUP BY h
	`, since)
	if err != nil {
		return out, err
	}
	defer hourRows.Close()
	for hourRows.Next() {
		var h, c int
		if err := hourRows.Scan(&h, &c); err != nil {
			return out, err
		}
		if h >= 0 && h < 24 {
			out.EventsByHour[h] = BusiestHour{Hour: h, Events: c}
		}
	}
	if err := hourRows.Err(); err != nil {
		return out, err
	}

	latRows, err := s.db.Query(`
		SELECT path, AVG(duration_ms) AS avg_ms, COUNT(*) AS c
		FROM events
		WHERE type = 'api' AND ts >= ? AND path IS NOT NULL AND path != '' AND duration_ms IS NOT NULL
		GROUP BY path
		HAVING c >= 1
		ORDER BY avg_ms DESC
		LIMIT 8
	`, since)
	if err != nil {
		return out, err
	}
	defer latRows.Close()
	for latRows.Next() {
		var item SlowestAPI
		if err := latRows.Scan(&item.Path, &item.AvgMs, &item.Samples); err != nil {
			return out, err
		}
		out.APILatency = append(out.APILatency, item)
	}
	if err := latRows.Err(); err != nil {
		return out, err
	}

	return out, nil
}
