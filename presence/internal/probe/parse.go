package probe

import (
	"net"
	"regexp"
	"strings"
)

var (
	ttlRe           = regexp.MustCompile(`(?i)ttl=\d+`)
	neighborStateRe = regexp.MustCompile(`(?i)\b(REACHABLE|STALE|DELAY|PROBE|PERMANENT|FAILED|INCOMPLETE)\b`)
	unicastMACRe    = regexp.MustCompile(`(?i)([0-9a-f]{2}[:-]){5}[0-9a-f]{2}`)
)

var homeNeighborStates = map[string]struct{}{
	"REACHABLE": {},
	"STALE":     {},
	"DELAY":     {},
	"PROBE":     {},
	"PERMANENT": {},
}

// SanitizeHost accepts RFC1918 IPv4 only (same rules as the Node settings layer).
func SanitizeHost(value string) string {
	raw := strings.TrimSpace(value)
	ip := net.ParseIP(raw)
	if ip == nil {
		return ""
	}
	v4 := ip.To4()
	if v4 == nil {
		return ""
	}
	a, b := int(v4[0]), int(v4[1])
	private := a == 10 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168)
	if !private {
		return ""
	}
	return v4.String()
}

func PingLooksAlive(stdout string, err error, windows bool) bool {
	if windows {
		return ttlRe.MatchString(stdout)
	}
	return err == nil
}

func ArpLineLooksAlive(line, host string) bool {
	if !strings.Contains(strings.ToLower(line), strings.ToLower(host)) {
		return false
	}
	upper := strings.ToUpper(line)
	if regexp.MustCompile(`\b(FAILED|INCOMPLETE)\b`).MatchString(upper) {
		return false
	}
	if regexp.MustCompile(`(?i)ff:ff:ff:ff:ff:ff|ff-ff-ff-ff-ff-ff`).MatchString(line) {
		return false
	}
	if match := neighborStateRe.FindStringSubmatch(upper); len(match) > 1 {
		_, ok := homeNeighborStates[match[1]]
		return ok
	}
	return unicastMACRe.MatchString(line)
}

func ProcNetARPAlive(table, host string) bool {
	for _, line := range strings.Split(table, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, host) {
			continue
		}
		cols := strings.Fields(line)
		if len(cols) >= 3 && cols[2] == "0x2" {
			return true
		}
	}
	return false
}
