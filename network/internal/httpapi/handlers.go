package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/displayproject/network/internal/netstats"
)

type Server struct {
	Collector *netstats.Collector
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /stats", s.handleStats)
	mux.HandleFunc("GET /summary", s.handleSummary)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.Collector.Stats(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to collect network stats"})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := s.Collector.Summary(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to collect network summary"})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
