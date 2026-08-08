//go:build windows

package netstats

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

// samplePlatformCounters reads NIC byte counters via IP Helper (GetIfEntry2Ex).
func samplePlatformCounters(preferred string) (*string, *Counters) {
	ifaces := map[string]Counters{}
	_ = enumerateWindowsAdapters(func(name string, index uint32, _ *windows.IpAdapterAddresses) {
		row := windows.MibIfRow2{InterfaceIndex: index}
		if err := windows.GetIfEntry2Ex(0, &row); err != nil {
			return
		}
		ifaces[name] = Counters{
			RxBytes: int64(row.InOctets),
			TxBytes: int64(row.OutOctets),
		}
	})
	name := PickInterface(ifaces, preferred)
	if name == "" {
		return nil, nil
	}
	counters := ifaces[name]
	return &name, &counters
}

func platformDefaultGateway() *string {
	var gateway string
	_ = enumerateWindowsAdapters(func(_ string, _ uint32, aa *windows.IpAdapterAddresses) {
		if gateway != "" || aa.OperStatus != windows.IfOperStatusUp {
			return
		}
		if aa.IfType == windows.IF_TYPE_SOFTWARE_LOOPBACK {
			return
		}
		for gw := aa.FirstGatewayAddress; gw != nil; gw = gw.Next {
			ip := gw.Address.IP()
			if ip == nil {
				continue
			}
			ip4 := ip.To4()
			if ip4 == nil {
				continue
			}
			gateway = ip4.String()
			return
		}
	})
	if gateway == "" {
		return nil
	}
	return &gateway
}

func enumerateWindowsAdapters(fn func(name string, index uint32, aa *windows.IpAdapterAddresses)) error {
	var size uint32
	flags := uint32(windows.GAA_FLAG_INCLUDE_PREFIX | windows.GAA_FLAG_INCLUDE_GATEWAYS)
	err := windows.GetAdaptersAddresses(windows.AF_UNSPEC, flags, 0, nil, &size)
	if err != nil && err != windows.ERROR_BUFFER_OVERFLOW {
		return err
	}
	if size == 0 {
		return nil
	}
	buf := make([]byte, size)
	addr := (*windows.IpAdapterAddresses)(unsafe.Pointer(&buf[0]))
	if err := windows.GetAdaptersAddresses(windows.AF_UNSPEC, flags, 0, addr, &size); err != nil {
		return err
	}
	for aa := addr; aa != nil; aa = aa.Next {
		if aa.OperStatus != windows.IfOperStatusUp {
			continue
		}
		if aa.IfType == windows.IF_TYPE_SOFTWARE_LOOPBACK {
			continue
		}
		name := windows.UTF16PtrToString(aa.FriendlyName)
		if name == "" {
			name = windows.BytePtrToString(aa.AdapterName)
		}
		if name == "" {
			continue
		}
		fn(name, aa.IfIndex, aa)
	}
	return nil
}
