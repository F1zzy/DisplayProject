package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/displayproject/analytics/internal/store"
)

type Server struct {
	Store *store.Store
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("POST /metrics", s.handleMetrics)
	mux.HandleFunc("GET /summary", s.handleSummary)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type metricsBody struct {
	store.Event
	Events []store.Event `json:"events"`
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	var body metricsBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	events := body.Events
	if body.Type != "" {
		events = append(events, body.Event)
	}
	if len(events) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no events"})
		return
	}

	normalized := make([]store.Event, 0, len(events))
	for _, e := range events {
		e.Type = strings.TrimSpace(e.Type)
		switch e.Type {
		case "api", "widget_view", "power":
			normalized = append(normalized, e)
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid event type"})
			return
		}
	}

	if err := s.Store.Insert(normalized); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to store events"})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"ok": true, "count": len(normalized)})
}

func (s *Server) handleSummary(w http.ResponseWriter, _ *http.Request) {
	summary, err := s.Store.Summary()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to build summary"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
