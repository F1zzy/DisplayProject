//go:build !windows

package netstats

// samplePlatformCounters is used when /proc/net/dev is unavailable (non-Windows stub).
func samplePlatformCounters(_ string) (*string, *Counters) {
	return nil, nil
}

func platformDefaultGateway() *string {
	return nil
}
