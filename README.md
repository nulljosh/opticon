# Opticon

Map-first situation monitor with scrolling stock tickers, personal finance dashboard, and integrated data feeds.

**Live**: https://opticon.heyitsmejosh.com

![Project Map](map.svg)

## What It Does

- Full-page live map with tactical HUD (traffic, crime, earthquakes, events, flights, weather)
- Scrolling stock ticker: Mag 7 + 100 US assets, 30s refresh (FMP primary, Yahoo fallback)
- Prediction markets geo-anchored as map pins (Polymarket)
- Personal finance panel: portfolio, budget, debt, goals, spending trends
- Server-side portfolio persistence via Vercel KV + CLI access (`balance`)
- Auth system: bcrypt, httpOnly sessions, email verification

## Stack

- React 19 + Vite + MapLibre GL
- Vercel serverless (`api/gateway.js` single function, 20+ routes)
- Vercel KV (Upstash Redis) for auth, sessions, portfolio
- FMP + Yahoo Finance + Polymarket + GDELT + USGS + OSM + PredictHQ

## Run

```bash
npm install
npm run dev
```

## Layout

- `src/` -- UI components, hooks, utils
- `server/api/` -- handler modules (stocks, auth, portfolio, traffic, earthquakes, etc.)
- `api/gateway.js` -- single serverless entry point
- `docs/` -- GitHub Pages docs site

## Coming Soon

- Live markets panel with per-stock charts
- Trading simulator UI (coded, not yet visible)
- Custom watchlist with autocomplete ticker search

## Deploy

Pushing `main` triggers Vercel production deploy at `opticon.heyitsmejosh.com`.

## License

MIT. Not financial advice.
