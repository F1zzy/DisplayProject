package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/displayproject/presence/internal/monitor"
)

type Server struct {
	Monitor *monitor.Monitor
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("PUT /config", s.handleConfig)
	mux.HandleFunc("GET /status", s.handleStatus)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type configBody struct {
	Enabled     bool   `json:"enabled"`
	Host        string `json:"host"`
	IntervalMs  int    `json:"intervalMs"`
	AwayAfterMs int    `json:"awayAfterMs"`
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	var body configBody
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	s.Monitor.SetConfig(monitor.Config{
		Enabled:     body.Enabled,
		Host:        body.Host,
		IntervalMs:  body.IntervalMs,
		AwayAfterMs: body.AwayAfterMs,
	})
	writeJSON(w, http.StatusOK, s.Monitor.Tick())
}

func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.Monitor.Tick())
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
