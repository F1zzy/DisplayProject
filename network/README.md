# DisplayProject Network

Go microservice that probes connectivity latency, samples local NIC rx/tx rates (Linux `/proc/net/dev`), resolves host/gateway/public IP, and keeps a short in-memory history for the remote **Network** tab. The Node backend proxies `GET /api/network/stats` (kiosk) and auth-gated `GET /api/network/summary` (remote).

## Run

```bash
cd network
go run ./cmd/network
```

Listens on `http://127.0.0.1:3011` by default.

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `3011` | Listen port |
| `NETWORK_IFACE` | _(auto)_ | Preferred interface (`eth0`, `wlan0`, …) |
| `NETWORK_PROBE_URL` | `https://www.gstatic.com/generate_204` | Lightweight online/latency probe |
| `NETWORK_PROC_NET_DEV` | `/proc/net/dev` | Counter source (Linux) |
| `NETWORK_PUBLIC_IP_URL` | `https://api.ipify.org?format=json` | Cached outbound public IP |
| `NETWORK_DNS_TARGET` | `1.1.1.1:443` | TCP connect target for DNS latency |

On Windows, NIC rates/gateway use the IP Helper API. Online/latency and public IP still work via HTTPS probes even when counters are unavailable.

## Endpoints

- `GET /health` — liveness
- `GET /stats` — lean cached (~15s) payload for the kiosk widget
- `GET /summary` — richer payload with `targets[]`, `history[]`, and `windowSamples` for the remote panel

Point the Node backend at this service with `NETWORK_SERVICE_URL=http://127.0.0.1:3011` in `backend/.env`. Set `NETWORK_SERVICE_URL=false` to disable (API returns a degraded offline payload).
