# DisplayProject

Widget-style dashboard for a secondary monitor, with weather, stocks, news, and a daily timetable. Controlled remotely via a web PWA and Alexa skill.

## Features

- Live clock and current weather
- 3-day and hourly forecast views
- Rotating widgets: stocks, news, timetable (Google Calendar), network, night sky
- Backend API proxy (API keys stay server-side)
- Remote control page at `/remote` (API-key unlock + dashboard settings)
- WebSocket updates for display power, widgets, and settings
- Raspberry Pi kiosk install with HDMI power control
- Alexa skill stub in [`alexa/`](alexa/)

## Prerequisites

- Node.js 18+
- API keys from [WeatherAPI](https://www.weatherapi.com/), [NewsAPI](https://newsapi.org/), and [Alpha Vantage](https://www.alphavantage.co/)
- Optional: Google Cloud OAuth client for the Schedule widget (see [Google Calendar](#google-calendar-schedule-widget))

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

For the Night Sky widget, add `ASTRONOMY_APP_ID` and `ASTRONOMY_APP_SECRET` from [AstronomyAPI](https://astronomyapi.com/). The star chart and visible planets/Moon both use AstronomyAPI.

**Important:** If this repo was ever public with committed keys, rotate them at each provider.

## Google Calendar (Schedule widget)

The Schedule widget loads today’s events from Google Calendar via the backend. Tokens stay server-side.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or pick one).
2. Enable **Google Calendar API**.
3. Create **OAuth client ID** → application type **Desktop app**.
4. Copy the Client ID and Client Secret into `backend/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. While the OAuth app is in Testing mode, add your Google account as a test user.
6. From `backend/`, run the one-time auth script:

```bash
cd backend
node scripts/google-calendar-auth.js
```

7. Open the printed URL, grant **readonly** calendar access, then paste `GOOGLE_REFRESH_TOKEN=...` into `backend/.env`.
8. Optionally set `GOOGLE_CALENDAR_ID` (default `primary`).

Restart the server. The Schedule widget will show today’s events (or a connect message if env vars are missing).

To force a new refresh token, revoke the app at [Google Account permissions](https://myaccount.google.com/permissions) and run the auth script again.

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
3. Enter your `CONTROL_API_KEY` from `backend/.env` and tap **Unlock**
4. Use On / Sleep / Off and widget buttons
5. Under **Dashboard Settings**, change location, stocks, widgets, rotation, news, calendar, background (default / colour / image URL), appearance (colour scheme, font, clock animation, weather atmosphere, night focus), and layout (section order/visibility, clock side, density), then **Save settings** — the kiosk updates live over WebSocket

Enable **Night Sky** under Enabled widgets to show the AstronomyAPI chart and visible planets/Moon strip.

The remote page stays locked until the API key is verified. Lock the session when finished. Settings are stored in `backend/data/settings.json` (not committed).

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
| `GET /api/calendar/events?days=1` | Today’s Google Calendar events (503 if not configured) |
| `GET /api/network/stats` | Connection latency + local NIC rx/tx rates (light probe, cached ~15s) |
| `GET /api/sky/current` | Night sky chart URL + bodies above horizon (cached ~45m) |
| `GET /api/settings` | Dashboard preferences (location, widgets, stocks, etc.) |
| `PUT /api/settings` | Update preferences (requires `x-api-key`); broadcasts `settings:update` |
| `GET /api/display/state` | Display state |
| `POST /api/display/auth/verify` | Validate `CONTROL_API_KEY` for remote unlock |
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
