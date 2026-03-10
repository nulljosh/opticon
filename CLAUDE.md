# Opticon Notes

## What This App Is

Opticon is a live map and market app.

The map is the main view. The other views sit on top of it.

The top bar shows live prices. The right side or mobile sheet shows the current view.

## What To Protect

- Keep the map feeling steady.
- Do not let the app jump to a random city on load.
- Do not show fake stock prices before real ones arrive.
- Keep the phone view simple and easy to tap.
- Keep the account menu easy to find.

## Layout Rules

- Start with the phone layout first.
- The map should stay visible behind the panels.
- On phones, tapping the same tab should open and hide the sheet.
- On larger screens, the side panel should stay clear and readable.

## Simulator Notes

- The simulator should feel centered and calm.
- Updating the simulator number should not make the map flash.
- The simulator should not push the map out of place.

## Running It

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

## Deploy Notes

Production is still on Vercel.

Cloudflare is the slow, safe path for later. Move the API first, test it, then move more only when it feels solid.

## Current Priorities

- keep the phone layout stable
- keep the top bar moving cleanly
- keep the map locked to the best real location available
