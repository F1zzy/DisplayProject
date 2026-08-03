#!/usr/bin/env bash
# Set Raspberry Pi / HDMI display brightness (0–100).
# Tries: sysfs backlight → ddcutil (DDC/CI) → xrandr software brightness.
set -euo pipefail

PERCENT="${1:-}"
if ! [[ "$PERCENT" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <0-100>" >&2
  exit 1
fi

if (( PERCENT < 0 )); then PERCENT=0; fi
if (( PERCENT > 100 )); then PERCENT=100; fi

# Avoid a fully black panel when the UI clamps low
if (( PERCENT < 5 )); then PERCENT=5; fi

applied=0

# --- Official / DSI / some panels: /sys/class/backlight ---
shopt -s nullglob
for brightness_file in /sys/class/backlight/*/brightness; do
  dir="$(dirname "$brightness_file")"
  max_file="$dir/max_brightness"
  if [[ -r "$max_file" && -w "$brightness_file" ]]; then
    max="$(cat "$max_file")"
    if [[ "$max" =~ ^[0-9]+$ ]] && (( max > 0 )); then
      value=$(( PERCENT * max / 100 ))
      if (( value < 1 )); then value=1; fi
      if (( value > max )); then value=$max; fi
      echo "$value" > "$brightness_file" 2>/dev/null && applied=1
    fi
  fi
done
shopt -u nullglob

# --- External HDMI monitors with DDC/CI ---
if command -v ddcutil >/dev/null 2>&1; then
  if ddcutil setvcp 10 "$PERCENT" >/dev/null 2>&1; then
    applied=1
  fi
fi

# --- Desktop kiosk: xrandr gamma/brightness (needs X) ---
export DISPLAY="${DISPLAY:-:0}"
if [[ -z "${XAUTHORITY:-}" ]]; then
  for xa in /home/*/.Xauthority; do
    if [[ -f "$xa" ]]; then
      export XAUTHORITY="$xa"
      break
    fi
  done
fi

if command -v xrandr >/dev/null 2>&1; then
  # Map 0–100 → 0.15–1.0 so the screen never goes fully black via xrandr
  scale="$(awk -v p="$PERCENT" 'BEGIN { printf "%.3f", 0.15 + (p / 100.0) * 0.85 }')"
  outputs="$(xrandr --current 2>/dev/null | awk '/ connected/{print $1}')" || true
  for output in $outputs; do
    if xrandr --output "$output" --brightness "$scale" >/dev/null 2>&1; then
      applied=1
    fi
  done
fi

if (( applied == 0 )); then
  echo "No brightness control method available (backlight, ddcutil, or xrandr)." >&2
  exit 2
fi

exit 0
