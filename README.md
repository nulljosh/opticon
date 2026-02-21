# Rise

Fast financial terminal with live markets, prediction signals, and a paper-trading simulator.

**Live**: https://rise-production.vercel.app  
**Docs**: https://heyitsmejosh.com/rise/

![Project Map](map.svg)

## Stack

- React 19 + Vite
- Vercel serverless API (`api/`)
- Polymarket + Yahoo Finance data
- Situation Monitor map (flights, traffic, construction incidents, seismic)
- Global geopolitical event feed (GDELT panel)
- Vitest + Playwright tests

## Map-First Mode

- Full-page live map backdrop with event pulses
- User location pin + recenter control
- Local overlays: traffic incidents + construction/barriers + seismic events
- Global feed pulses: geopolitical events

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

## Layout

- `src/` app UI, hooks, utils
- `api/` market + broker endpoints
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
