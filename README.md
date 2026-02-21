# Rise

Fast financial terminal with live markets, prediction signals, and a paper-trading simulator.

**Live**: https://rise-production.vercel.app  
**Docs**: https://heyitsmejosh.com/rise/

![Project Map](map.svg)

## Stack

- React 19 + Vite
- Vercel serverless API gateway (`api/gateway.js`) + handlers in `server/api/`
- Polymarket + Yahoo Finance data
- Situation Monitor map (flights, traffic, construction incidents, seismic)
- Global geopolitical event feed (GDELT panel)
- Vitest + Playwright tests

## Map-First Mode

- Full-page live map backdrop with pulsing event markers
- Tactical HUD visual pass inspired by map-intel interfaces (grid + status badge + neon controls)
- Fast default map startup at NYC, then geolocation recenter when available
- Small-town zoom behavior: when device location is available, map auto-focuses at neighborhood-level detail (not metro-wide)
- User location drop-pin (`YOU`) + recenter control
- Local overlays: traffic incidents + construction/barriers + seismic events
- Prediction markets projected onto geographic anchors (city/team/politics keyword inference)
- Global feed pulses: geopolitical events
- Viewport-based local refresh: panning to a new city refreshes local overlays for that city
- Baseline fallback local markers keep map non-empty when upstream feeds are sparse

Note:
- Only predictions with a clear geographic anchor are plotted on the map.
- Non-geographic markets are intentionally hidden from map rendering for now.

Local dev fallback:
- In dev, map/event calls can use `VITE_API_BASE_URL`
- If unset, dev defaults to `https://rise-production.vercel.app` for JSON-safe API responses

## Run

```bash
npm install
npm run dev
```

Local URL: `http://localhost:5173`

## Commands

```bash
npm test
npm run build
npm run test:speed
```

## Reliability Notes

- Stock fetch path now uses bounded timeout + retry/backoff and Yahoo provider fallback (`query1` -> `query2`).
- Stocks and markets APIs keep a short in-memory warm cache and can serve stale cached data on transient upstream failures.
- Frontend stock hook seeds from `/api/latest` cache, then refreshes live; UI now shows feed reliability state: `LIVE`, `FALLBACK`, or `STALE`.

## Layout

- `src/` app UI, hooks, utils
- `api/gateway.js` single serverless entry
- `server/api/` handler modules
- `tests/` API and integration tests

## Deploy

- `main` branch: production deploy (Vercel if repo-connected)
- GitHub Pages workflow also runs on `main`

## Pricing

- `Free`: core dashboard + simulator
- `Starter`: `$20/mo`
- `Pro`: `$50/mo`

Stripe price IDs expected by UI/API:

- `VITE_STRIPE_PRICE_ID_STARTER`
- `VITE_STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_PRO`

Apple Pay note: Stripe Checkout can surface Apple Pay automatically on supported Apple devices after Stripe domain verification is configured.

## License

MIT. Not financial advice.

## Name Ideas

- Sentinel
- Aegis
- Citadel
- Bastion
- Atlas
- Beacon
- Vigil
- Nexus
- Overwatch
- Horizon
- Signal
- Gridlock
