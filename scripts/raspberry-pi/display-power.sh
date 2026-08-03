#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"

if [[ "$ACTION" != "on" && "$ACTION" != "off" && "$ACTION" != "sleep" ]]; then
  echo "Usage: $0 {on|off|sleep}" >&2
  exit 1
fi

if command -v vcgencmd >/dev/null 2>&1; then
  if [[ "$ACTION" == "on" ]]; then
    vcgencmd display_power 1 >/dev/null 2>&1 || true
  else
    vcgencmd display_power 0 >/dev/null 2>&1 || true
  fi
fi

if [[ -n "${DISPLAY:-}" ]] && command -v xset >/dev/null 2>&1; then
  if [[ "$ACTION" == "on" ]]; then
    xset dpms force on >/dev/null 2>&1 || true
  else
    xset dpms force off >/dev/null 2>&1 || true
  fi
fi
