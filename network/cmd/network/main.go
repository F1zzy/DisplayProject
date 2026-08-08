package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/displayproject/network/internal/httpapi"
	"github.com/displayproject/network/internal/netstats"
)

func main() {
	port := envOr("PORT", "3011")
	collector := netstats.New(netstats.Options{
		ProbeURL:     envOr("NETWORK_PROBE_URL", netstats.DefaultProbeURL),
		Iface:        os.Getenv("NETWORK_IFACE"),
		ProcNetDev:   envOr("NETWORK_PROC_NET_DEV", netstats.DefaultProcNetDev),
		PublicIPURL:  envOr("NETWORK_PUBLIC_IP_URL", netstats.DefaultPublicIPURL),
		DNSTarget:    envOr("NETWORK_DNS_TARGET", netstats.DefaultDNSTargetHost),
		CacheTTL:     15 * time.Second,
		ProbeTimeout: 2 * time.Second,
		PublicIPTTL:  10 * time.Minute,
	})

	srv := &httpapi.Server{Collector: collector}
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("network listening on http://127.0.0.1:%s", port)
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
