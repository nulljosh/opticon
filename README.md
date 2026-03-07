<div align="center">

# Opticon

<img src="icon.svg" alt="Opticon" width="120" />

Financial terminal and situation monitor.

[opticon.heyitsmejosh.com](https://opticon.heyitsmejosh.com)

</div>

![version](https://img.shields.io/badge/version-v2.1.0-blue)

## Architecture

![Architecture](architecture.svg)

## Stack

- React 19, Vite, MapLibre GL
- Vercel serverless gateway (25+ routes)
- Vercel KV (auth, sessions, portfolio)
- FMP + Yahoo Finance (stock data)
- Polymarket, GDELT, USGS, CoinGecko
- Stripe (billing)

## Dev

```bash
npm install && npm run dev   # localhost:5173
npm test -- --run && npm run build
git push origin main         # triggers Vercel deploy
```

## License

MIT 2026, Joshua Trommel
