package probe

import (
	"bytes"
	"context"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

func IsOwnAddress(host string) bool {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return false
	}
	for _, addr := range addrs {
		var ip net.IP
		switch v := addr.(type) {
		case *net.IPNet:
			ip = v.IP
		case *net.IPAddr:
			ip = v.IP
		}
		if ip != nil && ip.To4() != nil && ip.String() == host {
			return true
		}
	}
	return false
}

func ICMPPing(host string) bool {
	args := []string{"-c", "1", "-W", "1", host}
	if runtime.GOOS == "windows" {
		args = []string{"-n", "1", "-w", "1000", host}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ping", args...)
	hideWindow(cmd)
	out, err := cmd.CombinedOutput()
	return PingLooksAlive(string(out), err, runtime.GOOS == "windows")
}

func ARPReachable(host string) bool {
	if runtime.GOOS == "windows" {
		ctx, cancel := context.WithTimeout(context.Background(), 2000*time.Millisecond)
		defer cancel()
		cmd := exec.CommandContext(ctx, "arp", "-a", host)
		hideWindow(cmd)
		out, _ := cmd.CombinedOutput()
		return anyLineAlive(string(out), host)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2000*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ip", "neigh", "show", host)
	hideWindow(cmd)
	out, err := cmd.CombinedOutput()
	if err == nil && len(bytes.TrimSpace(out)) > 0 {
		return anyLineAlive(string(out), host)
	}

	table, readErr := os.ReadFile("/proc/net/arp")
	if readErr != nil {
		return false
	}
	return ProcNetARPAlive(string(table), host)
}

func anyLineAlive(stdout, host string) bool {
	for _, line := range strings.Split(stdout, "\n") {
		if ArpLineLooksAlive(line, host) {
			return true
		}
	}
	return false
}

func Default(host string) bool {
	if ICMPPing(host) {
		return true
	}
	return ARPReachable(host)
}
