# Rise - Claude Guide

## Deployment Targets

- Vercel production: `https://rise-production.vercel.app/`
- GitHub Pages docs shell: `https://heyitsmejosh.com/rise/`

Use the Vercel production URL for runtime/API validation.

## What This Project Is

Rise is a financial terminal app with:

- High-speed simulator UI (`src/App.jsx`)
- Personal finance panel (`src/components/FinancePanel.jsx`) -- portfolio, budget, debt, goals, spending
- Prediction market feed and filters
- Map-first backdrop + overlays (`src/components/LiveMapBackdrop.jsx`)
- Tactical HUD styling pass (grid overlay + live status badge + neon map controls)
- Single serverless API entry (`api/gateway.js`) with handlers under `server/api/`
- Stock data: FMP batch quotes (primary) + Yahoo Finance (fallback)
- Geolocation zoom policy: granted GPS uses neighborhood zoom; cached location uses near-neighborhood zoom; IP fallback stays wider.

## Finance Panel (finn merge)

- `src/components/FinancePanel.jsx` -- full-screen finance overlay
- `src/hooks/usePortfolio.js` -- portfolio data hook, localStorage persistence
- `src/utils/financeData.js` -- demo data + JSON schema validation
- PORTFOLIO button in header opens the panel
- Users can import/export JSON balance sheets
- Demo data from finn/ loads by default
- Live stock prices from useStocks merge into holdings for real-time valuation
- `finn/scripts/` and `finn/cli/` kept as local CLI tooling

## Situation Monitor Data Sources

- Flights: `/api/flights`
- Traffic flow + nearby incidents: `/api/traffic`
- Construction/barrier incidents: `/api/incidents`
- Earthquakes: `/api/earthquakes`
- Global geopolitical events feed: `/api/events`
- Weather alerts: `/api/weather-alerts`

Notes:
- Map overlays include traffic/construction/seismic/global-event markers.
- Local overlays refresh by current map viewport center.
- Fallback markers are intentionally injected when upstream feeds are sparse, to avoid empty-city states.
- Predictions are shown only when a confident geographic anchor is inferred.

## Local Development

```bash
npm install
npm run dev
```

App URL: `http://localhost:5173`

## Test + Build

```bash
npm test -- --run
npm run build
```

## Deployment Workflow

```bash
git checkout main
git pull
npm test -- --run
git add .
git commit -m "..."
git push origin main
```

If Vercel is connected to this repo with production branch `main`, pushing `main` triggers a production deployment.
If Hobby deploys fail with function-count errors, ensure endpoint logic stays in `server/api/` and only `api/gateway.js` is deployed as the runtime function.

## Billing / Upgrade

- Pricing modal offers `Free`, `Starter ($20)`, and `Pro ($50)`.
- Checkout endpoint is `POST /api/stripe?action=checkout` with `{ priceId }`.
- Allowed price IDs are controlled by:
  - `STRIPE_PRICE_ID_STARTER`
  - `STRIPE_PRICE_ID_PRO`
  - `VITE_STRIPE_PRICE_ID_STARTER`
  - `VITE_STRIPE_PRICE_ID_PRO`
- Apple Pay is handled by Stripe Checkout on supported devices once domain verification is enabled in Stripe.

## Stock Data API

- FMP (Financial Modeling Prep) is the primary stock data source. Requires `FMP_API_KEY` env var.
- Yahoo Finance chart API is the fallback when FMP is unavailable or quota exhausted.
- 90s cache TTL to stay within FMP 250 req/day free tier.
- `X-Rise-Data-Source` header shows which provider served the data (`fmp`/`yahoo`/`mixed`).

## Current Priorities

- Keep simulator and monitor responsive
- Keep API handlers small and test-covered
- Deduplicate logic before adding new features
- Preserve UI behavior unless explicitly requested
