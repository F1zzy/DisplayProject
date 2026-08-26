package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/displayproject/presence/internal/monitor"
)

func TestHealthAndConfigRoundTrip(t *testing.T) {
	reachable := false
	mon := monitor.New(func(string) bool { return reachable }, func(string) bool { return false })
	srv := &Server{Monitor: mon}
	handler := srv.Routes()

	health := httptest.NewRequest(http.MethodGet, "/health", nil)
	hw := httptest.NewRecorder()
	handler.ServeHTTP(hw, health)
	if hw.Code != http.StatusOK {
		t.Fatalf("health=%d", hw.Code)
	}

	body, _ := json.Marshal(map[string]any{
		"enabled":     true,
		"host":        "10.255.255.50",
		"intervalMs":  15000,
		"awayAfterMs": 30000,
	})
	req := httptest.NewRequest(http.MethodPut, "/config", bytes.NewReader(body))
	rw := httptest.NewRecorder()
	handler.ServeHTTP(rw, req)
	if rw.Code != http.StatusOK {
		t.Fatalf("config=%d %s", rw.Code, rw.Body.String())
	}

	var status monitor.Status
	if err := json.Unmarshal(rw.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if !status.Enabled || status.Host != "10.255.255.50" {
		t.Fatalf("status=%+v", status)
	}
	if status.Home == nil || *status.Home {
		t.Fatalf("expected miss home=false, got %+v", status)
	}
	if status.Away {
		t.Fatal("not away yet")
	}

	reachable = true
	statusReq := httptest.NewRequest(http.MethodGet, "/status", nil)
	sw := httptest.NewRecorder()
	handler.ServeHTTP(sw, statusReq)
	if sw.Code != http.StatusOK {
		t.Fatalf("status code=%d", sw.Code)
	}
	if err := json.Unmarshal(sw.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if status.Home == nil || !*status.Home || status.Away {
		t.Fatalf("expected home after GET probe, got %+v", status)
	}
}

func TestConfigRejectsUnknownFields(t *testing.T) {
	mon := monitor.New(func(string) bool { return true }, func(string) bool { return false })
	handler := (&Server{Monitor: mon}).Routes()
	req := httptest.NewRequest(http.MethodPut, "/config", bytes.NewBufferString(`{"enabled":true,"nope":1}`))
	rw := httptest.NewRecorder()
	handler.ServeHTTP(rw, req)
	if rw.Code != http.StatusBadRequest {
		t.Fatalf("code=%d", rw.Code)
	}
}
