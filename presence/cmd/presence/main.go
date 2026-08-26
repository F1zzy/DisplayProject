package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/displayproject/presence/internal/httpapi"
	"github.com/displayproject/presence/internal/monitor"
	"github.com/displayproject/presence/internal/probe"
)

func main() {
	port := envOr("PORT", "3012")
	mon := monitor.New(probe.Default, probe.IsOwnAddress)

	srv := &httpapi.Server{Monitor: mon}
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("presence listening on http://127.0.0.1:%s", port)
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
