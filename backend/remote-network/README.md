# DisplayProject Remote Network charts

Vite + React + Tailwind island for the remote **Network** tab. Uses [Bklit](https://bklit.com/) chart components (same stack as remote-analytics).

## Develop

```bash
cd backend/remote-network
npm install
npm run dev
```

## Build

```bash
cd backend/remote-network
npm run build
```

Writes static assets to `../remote/network-app/` (`base: /remote/network-app/`). From `backend/` you can also run `npm run build:remote-network`.

The remote page loads these assets when the Network tab opens and refreshes charts on `network:refresh`.
