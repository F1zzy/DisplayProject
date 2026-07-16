#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$(cd "$2" && pwd)"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--app-dir /path/to/DisplayProject]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$APP_DIR/backend" || ! -d "$APP_DIR/backend/client" ]]; then
  echo "Could not find backend/ and backend/client/ under: $APP_DIR" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 20+ on Raspberry Pi OS first." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node.js 18+ is required (found $(node -v))." >&2
  exit 1
fi

echo "==> Installing backend dependencies"
(cd "$APP_DIR/backend" && npm ci --omit=dev)

echo "==> Installing client dependencies"
(cd "$APP_DIR/backend/client" && npm ci)

echo "==> Building client"
(cd "$APP_DIR/backend" && npm run build:client)

if [[ ! -f "$APP_DIR/backend/.env" ]]; then
  cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
  echo "Created backend/.env from .env.example — add your API keys before rebooting."
fi

if ! grep -q '^HOST=' "$APP_DIR/backend/.env"; then
  echo 'HOST=0.0.0.0' >> "$APP_DIR/backend/.env"
fi

if ! grep -q '^DISPLAY_POWER_CMD=' "$APP_DIR/backend/.env"; then
  echo 'DISPLAY_POWER_CMD=/usr/local/bin/displayproject-display-power' >> "$APP_DIR/backend/.env"
fi

if ! grep -q '^DISPLAY_BRIGHTNESS_CMD=' "$APP_DIR/backend/.env"; then
  echo 'DISPLAY_BRIGHTNESS_CMD=/usr/local/bin/displayproject-display-brightness' >> "$APP_DIR/backend/.env"
fi

echo "==> Installing display power script"
sudo install -m 755 "$SCRIPT_DIR/display-power.sh" /usr/local/bin/displayproject-display-power

echo "==> Installing display brightness script"
sudo install -m 755 "$SCRIPT_DIR/display-brightness.sh" /usr/local/bin/displayproject-display-brightness

echo "==> Installing systemd service"
SERVICE_FILE="$(mktemp)"
sed "s|__APP_DIR__|${APP_DIR}|g" "$SCRIPT_DIR/displayproject.service" > "$SERVICE_FILE"
sudo cp "$SERVICE_FILE" /etc/systemd/system/displayproject.service
rm -f "$SERVICE_FILE"

sudo systemctl daemon-reload
sudo systemctl enable displayproject.service
sudo systemctl restart displayproject.service

echo "==> Installing kiosk autostart"
chmod +x "$SCRIPT_DIR/kiosk.sh"
AUTOSTART_DIR="${HOME}/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
DESKTOP_FILE="$(mktemp)"
sed "s|__APP_DIR__|${APP_DIR}|g" "$SCRIPT_DIR/displayproject-kiosk.desktop" > "$DESKTOP_FILE"
cp "$DESKTOP_FILE" "$AUTOSTART_DIR/displayproject-kiosk.desktop"
rm -f "$DESKTOP_FILE"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
PORT="$(grep -E '^PORT=' "$APP_DIR/backend/.env" | cut -d= -f2- || echo 3000)"
PORT="${PORT:-3000}"

echo
echo "DisplayProject installed."
echo
echo "Next steps:"
echo "  1. Edit $APP_DIR/backend/.env and add your API keys"
echo "  2. Reboot: sudo reboot"
echo
echo "After reboot:"
echo "  Dashboard (kiosk): http://localhost:${PORT}"
if [[ -n "$LAN_IP" ]]; then
  echo "  Remote (phone):    http://${LAN_IP}:${PORT}/remote"
fi
echo
echo "Service status: sudo systemctl status displayproject"
echo "Service logs:   journalctl -u displayproject -f"
