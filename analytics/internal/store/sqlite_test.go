package store

import (
	"path/filepath"
	"testing"
	"time"
)

func TestSummaryAggregates(t *testing.T) {
	dir := t.TempDir()
	st, err := Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	now := time.Now().UTC()
	ts := func(d time.Duration) string {
		return now.Add(d).Format(time.RFC3339Nano)
	}

	err = st.Insert([]Event{
		{Type: "widget_view", WidgetKey: "spotify", Source: "auto", TS: ts(-1 * time.Hour)},
		{Type: "widget_view", WidgetKey: "spotify", Source: "auto", TS: ts(-2 * time.Hour)},
		{Type: "widget_view", WidgetKey: "news", Source: "rotate", TS: ts(-3 * time.Hour)},
		{Type: "api", Path: "/api/stocks", Method: "GET", Status: 200, DurationMs: 900, TS: ts(-1 * time.Hour)},
		{Type: "api", Path: "/api/stocks", Method: "GET", Status: 200, DurationMs: 700, TS: ts(-2 * time.Hour)},
		{Type: "api", Path: "/api/weather/current", Method: "GET", Status: 200, DurationMs: 100, TS: ts(-1 * time.Hour)},
		{Type: "power", PowerAction: "on", TS: ts(-30 * time.Minute)},
	})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	summary, err := st.Summary()
	if err != nil {
		t.Fatalf("summary: %v", err)
	}

	if summary.WindowHours != 24 {
		t.Fatalf("windowHours=%d", summary.WindowHours)
	}
	if summary.Totals.APICalls != 3 {
		t.Fatalf("apiCalls=%d", summary.Totals.APICalls)
	}
	if summary.Totals.WidgetViews != 3 {
		t.Fatalf("widgetViews=%d", summary.Totals.WidgetViews)
	}
	if summary.MostViewedWidget == nil || summary.MostViewedWidget.Key != "spotify" || summary.MostViewedWidget.Views != 2 {
		t.Fatalf("mostViewed=%+v", summary.MostViewedWidget)
	}
	if summary.SlowestAPI == nil || summary.SlowestAPI.Path != "/api/stocks" {
		t.Fatalf("slowestApi=%+v", summary.SlowestAPI)
	}
	if summary.SlowestAPI.AvgMs < 799 || summary.SlowestAPI.AvgMs > 801 {
		t.Fatalf("avgMs=%v", summary.SlowestAPI.AvgMs)
	}
	if summary.BusiestHour == nil || summary.BusiestHour.Events < 1 {
		t.Fatalf("busiestHour=%+v", summary.BusiestHour)
	}
}
