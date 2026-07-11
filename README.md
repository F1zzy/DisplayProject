# DisplayProject

Widget-style dashboard for a secondary monitor, with weather, stocks, news, and a daily timetable. Controlled remotely via a web PWA and Alexa skill.

## Features

- Live clock and current weather
- 3-day and hourly forecast views
- Rotating widgets: stocks, news, timetable
- Backend API proxy (API keys stay server-side)
- Remote control page at `/remote`
- WebSocket updates for display power and widget rotation
- Raspberry Pi kiosk install with HDMI power control
- Alexa skill stub in [`alexa/`](alexa/)

## Prerequisites

- Node.js 18+
- API keys from [WeatherAPI](https://www.weatherapi.com/), [NewsAPI](https://newsapi.org/), and [Alpha Vantage](https://www.alphavantage.co/)

## Setup

1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Install client dependencies:

```bash
cd client
npm install
```

3. Configure environment:

```bash
cp .env.example .env          # in backend/
cp .env.example .env          # in backend/client/
```

Fill in API keys in `backend/.env`. The client only needs `REACT_APP_LOCATION` (optional).

**Important:** If this repo was ever public with committed keys, rotate them at each provider.

## Production run

Build the client and start the server on port 3000:

```bash
cd backend
npm run build:client
npm start
```

Open `http://localhost:3000` on your display monitor.

## Development

Run the API server on port **3001** and the React dev server on port **3000** (with proxy):

```bash
# Terminal 1
cd backend
npm run dev:server

# Terminal 2
cd backend
npm run dev:client
```

## Raspberry Pi (kiosk display)

Run DisplayProject on **Raspberry Pi OS (desktop)** as a dedicated HDMI dashboard: Node starts on boot, Chromium opens fullscreen, and remote Sleep/Off turns the HDMI output off.

### Requirements

- Raspberry Pi 4 or 5 (recommended)
- Raspberry Pi OS 64-bit with desktop
- HDMI monitor
- Node.js 20+ (`node -v`)

### Install

```bash
git clone <your-repo-url> ~/DisplayProject
cd ~/DisplayProject
cp backend/.env.example backend/.env   # add API keys + CONTROL_API_KEY
bash scripts/raspberry-pi/install.sh
sudo reboot
```

The installer will:

- Install production backend dependencies and build the React client
- Enable a `displayproject` systemd service (auto-restart on boot)
- Install HDMI power control at `/usr/local/bin/displayproject-display-power`
- Add a desktop autostart entry that launches Chromium in kiosk mode

### After reboot

- **Dashboard:** opens automatically in fullscreen on the HDMI monitor
- **Remote from phone:** `http://<pi-ip>:3000/remote` (same Wi‑Fi network)

Find the Pi IP:

```bash
hostname -I
```

Use that IP in the remote page’s Server URL field, plus your `CONTROL_API_KEY`.

### Optional: build on another machine

Building React on a Pi can take several minutes. You can build elsewhere and copy the output:

```bash
# On your PC
cd backend && npm run build:client

# Copy backend/client/build/ to the Pi, then on the Pi run install.sh
# (it will still rebuild unless build/ already exists — skip client build by
#  running only the systemd/kiosk steps from install.sh manually if needed)
```

### Troubleshooting

| Issue | What to try |
|---|---|
| Service not running | `sudo systemctl status displayproject` |
| Server logs | `journalctl -u displayproject -f` |
| Health check | `curl http://127.0.0.1:3000/api/health` |
| Kiosk not opening | Log out/in or reboot; check `~/.config/autostart/displayproject-kiosk.desktop` |
| HDMI won't wake | `displayproject-display-power on` |
| Phone can't connect | Confirm Pi IP, same network, and `HOST=0.0.0.0` in `backend/.env` |

Disable screen blanking in Pi OS desktop preferences as an extra safeguard against the monitor sleeping.

## Remote control

1. Start the server
2. Open `http://localhost:3000/remote` (or `http://<pi-ip>:3000/remote` from another device)
3. Enter your `CONTROL_API_KEY` from `backend/.env`
4. Use On / Sleep / Off and widget buttons

Install as a PWA on Android for a simple remote control app.

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/weather/current` | Current weather |
| `GET /api/weather/forecast` | 3-day forecast |
| `GET /api/weather/hourly` | Hourly forecast |
| `GET /api/stocks?symbols=AAPL,GOOGL,MSFT` | Stock data (cached, rate-limited) |
| `GET /api/news?category=general` | News headlines |
| `GET /api/display/state` | Display state |
| `POST /api/display/power` | `{ action: "on" \| "off" \| "sleep" }` (requires `x-api-key`) |
| `POST /api/display/widgets/rotate` | Next widget (requires `x-api-key`) |
| `WS /ws/display` | Real-time display events |

## Alexa

See [`alexa/README.md`](alexa/README.md) for skill setup.

## Tests

```bash
cd backend && npm test
cd backend/client && npm test
```
