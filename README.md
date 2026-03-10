![Opticon](icon.svg)
# Opticon
![version](https://img.shields.io/badge/version-v2.3.1-blue)

Opticon is a live market and map app. It puts prices, news, and local activity on one screen.

[Live site](https://opticon.heyitsmejosh.com)

## Architecture

![Architecture](architecture.svg)

## What It Does

- Shows live stock prices in the top bar
- Keeps the map front and center
- Lets you switch between Simulator, Portfolio, and Situation views
- Tries your real location first, then falls back if it has to

## Run It

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

## Deploy

Production still runs on Vercel.

There is also a Cloudflare preview path for later. The short version is simple:

- keep the site the same
- let Cloudflare handle the API step by step
- move the rest only after the preview feels solid

More detail lives in [docs/hosting.md](/Users/joshua/Documents/Code/opticon/docs/hosting.md).

## What Changed Recently

- The stock bar now waits for real prices instead of showing built-in ones first.
- The stock bar stays visible on small screens.
- The map now tries a fresh browser location before it falls back to an older saved spot or a rough guess.

## Next

- Finish checking the Cloudflare preview
- Keep smoothing out the phone layout
- Move more hosting work only after the preview feels stable

## License

MIT 2026, Joshua Trommel
