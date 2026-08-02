# DisplayProject Analytics

Small Go microservice that records API latency and widget-view events from the Node backend and exposes a JSON summary for the remote **Analytics** tab.

## Run

```bash
cd analytics
go run ./cmd/analytics
```

Listens on `http://127.0.0.1:3010` by default. SQLite file: `./data/analytics.db`.

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `3010` | Listen port |
| `ANALYTICS_DB` | `./data/analytics.db` | SQLite path |

## Endpoints

- `GET /health` — liveness
- `POST /metrics` — ingest one event or `{ "events": [...] }`
- `GET /summary` — last-24h summary (most viewed widget, busiest hour, slowest API)

Point the Node backend at this service with `ANALYTICS_URL=http://127.0.0.1:3010` in `backend/.env`.
