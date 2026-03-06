<div align="center">

# Opticon

<img src="icon.svg" alt="Opticon" width="120" />

Financial terminal and situation monitor. Live map, stock tickers, portfolio management, and prediction markets in one dashboard.

[opticon.heyitsmejosh.com](https://opticon.heyitsmejosh.com)

</div>

## Architecture

![Architecture](architecture.svg)

## Stack

- React 19 + Vite + MapLibre GL
- Vercel serverless (`api/gateway.js`, 20+ routes)
- Vercel KV (Upstash Redis) — auth, sessions, portfolio
- FMP batch API + Yahoo Finance (chunked fallback)
- Polymarket, GDELT, USGS, OSM, PredictHQ
- GDELT (news, events)
- Stripe

## Dev

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

## Roadmap

- [ ] Apple Pay via Stripe
- [ ] WebSocket real-time quotes
- [ ] Portfolio analytics dashboard
- [ ] Custom watchlist with alerts
- [ ] Prediction market accuracy tracking
