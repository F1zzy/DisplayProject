package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/displayproject/analytics/internal/httpapi"
	"github.com/displayproject/analytics/internal/store"
)

func main() {
	port := envOr("PORT", "3010")
	dbPath := envOr("ANALYTICS_DB", filepath.Join("data", "analytics.db"))

	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	srv := &httpapi.Server{Store: st}
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("analytics listening on http://127.0.0.1:%s (db=%s)", port, dbPath)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
