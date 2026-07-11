# DisplayProject

Widget-style dashboard for a secondary monitor, with weather, stocks, news, and a daily timetable. Controlled remotely via a web PWA and Alexa skill.

## Features

- Live clock and current weather
- 7-day and hourly forecast views
- Rotating widgets: stocks, news, timetable
- Backend API proxy (API keys stay server-side)
- Remote control page at `/remote`
- WebSocket updates for display power and widget rotation
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

## Remote control

1. Start the server
2. Open `http://localhost:3000/remote`
3. Enter your `CONTROL_API_KEY` from `backend/.env`
4. Use On / Sleep / Off and widget buttons

Install as a PWA on Android for a simple remote control app.

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/weather/current` | Current weather |
| `GET /api/weather/forecast` | 7-day forecast |
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
