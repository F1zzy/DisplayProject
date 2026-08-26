# DisplayProject Presence

Small Go microservice that pings a reserved phone IPv4 (ICMP, then ARP/neighbor) so the Node backend can sleep the kiosk when you leave Wi‑Fi and wake it when you return. The remote never talks to Go directly.

## Run

```bash
cd presence
go run ./cmd/presence
```

Listens on `http://127.0.0.1:3012` by default.

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `3012` | Listen port |

## Endpoints

- `GET /health` — liveness
- `PUT /config` — `{ enabled, host, intervalMs, awayAfterMs }` (private IPv4 only); probes once and returns status
- `GET /status` — probes now and returns `{ enabled, host, home, away }` (`home` is the last probe; `away` is true after the grace period of consecutive misses)

Point the Node backend at this service with `PRESENCE_SERVICE_URL=http://127.0.0.1:3012` in `backend/.env`. Set `PRESENCE_SERVICE_URL=false` to disable. If the service is down, presence fails open (no sleep/wake).
