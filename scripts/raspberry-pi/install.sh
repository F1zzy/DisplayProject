#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

WITH_F1_TOKEN_REFRESH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$(cd "$2" && pwd)"
      shift 2
      ;;
    --with-f1-token-refresh)
      WITH_F1_TOKEN_REFRESH=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--app-dir /path/to/DisplayProject] [--with-f1-token-refresh]" >&2
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

if [[ "$WITH_F1_TOKEN_REFRESH" -eq 1 ]]; then
  echo "==> Installing F1 token refresh timer"

  CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium || true)"
  if [[ -z "$CHROMIUM_BIN" ]]; then
    echo "Chromium was not found; install it with: sudo apt install chromium-browser" >&2
    exit 1
  fi

  # playwright-core drives the system Chromium, avoiding a browser download
  # that has no Raspberry Pi build.
  (cd "$APP_DIR/backend" && npm install --no-save playwright-core)

  if ! grep -q '^F1_BROWSER_PATH=' "$APP_DIR/backend/.env"; then
    echo "F1_BROWSER_PATH=${CHROMIUM_BIN}" >> "$APP_DIR/backend/.env"
  fi

  F1_UNIT="$(mktemp)"
  RUN_AS="${USER:-$(id -un)}"
  sed -e "s|__APP_DIR__|${APP_DIR}|g" -e "s|__USER__|${RUN_AS}|g" \
    "$SCRIPT_DIR/displayproject-f1-token.service" > "$F1_UNIT"
  sudo cp "$F1_UNIT" /etc/systemd/system/displayproject-f1-token.service
  sudo cp "$SCRIPT_DIR/displayproject-f1-token.timer" /etc/systemd/system/displayproject-f1-token.timer
  rm -f "$F1_UNIT"

  sudo systemctl daemon-reload
  sudo systemctl enable --now displayproject-f1-token.timer

  echo "Sign in once before the timer can renew anything:"
  echo "  cd $APP_DIR/backend && node scripts/f1-auth.js --login"
fi

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
