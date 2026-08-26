//go:build !windows

package probe

import "os/exec"

func hideWindow(_ *exec.Cmd) {}
