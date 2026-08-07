# Remote analytics charts

Vite + React + Tailwind island for the remote **Analytics** tab. Uses [Bklit](https://bklit.com/) chart components (`@bklit/bar-chart`, `@bklit/area-chart` via shadcn).

## Develop

```bash
npm install
npm run dev
```

## Build (served by Express under `/remote`)

```bash
npm run build
```

Writes static assets to `../remote/analytics-app/` (`base: /remote/analytics-app/`). From `backend/` you can also run `npm run build:remote-analytics`.

The remote page loads these assets when the Analytics tab opens and refreshes charts on `analytics:refresh`.
