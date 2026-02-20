# Rise: Technical Whitepaper

**Version**: 1.0
**Date**: February 2026
**Author**: Joshua Trommel ([@nulljosh](https://github.com/nulljosh))

---

## TLDR

Rise runs a momentum-based trading algorithm across 61 assets. It enters positions when price is trending up with low volatility, sizes bets based on Kelly Criterion (bigger bets when small, smaller when large), cuts losers at -1.7%, and rides winners to +5% with a trailing stop. Monte Carlo projects future price distributions using 5,000 simulated paths. Prediction market edge is detected when a contract prices a >90% outcome. The whole thing runs in under 10MB of memory.

---

## Abstract

Rise is a low-latency financial terminal delivering quantitative simulation, prediction market analysis, and live market data within a <10MB memory footprint. This document describes the core algorithms powering the trading simulator, Monte Carlo engine, options pricing, position sizing, and edge detection, along with the system design principles behind the platform.

---

## 1. Trading Simulator

The simulator models autonomous trading from $1 to $1B (and beyond to $1T) across 61 assets spanning indices, equities, crypto, and memecoins.

### 1.1 Price Model

Each tick, every asset price is updated using a bounded random walk with drift and trend components:

```
move = drift + trend[sym] + (rand - 0.5) * noise
newPrice = clamp(lastPrice * (1 + move), base * 0.7, base * 1.5)
```

Where:
- `drift = 0.0001` (persistent upward bias)
- `trend[sym]` resets with probability 0.05 per tick: `(rand - 0.45) * 0.006`
- `noise = 0.008` (peak-to-peak random component)
- Price is clamped to [70%, 150%] of the asset's base price

Three price ticks are generated per simulation step to smooth the signal.

### 1.2 Entry Signal

The algorithm scans all assets each step and selects the highest-quality entry based on five filters applied in order:

**Filter 1 - Cooldown**: Skip any symbol traded within the last 50 ticks.

**Filter 2 - Volatility filter**: Compute 10-bar realized volatility. Reject if standard deviation > 2.5%.

```
variance = sum((price_i - avg)^2 / avg^2) / 10
stddev = sqrt(variance)
if stddev > 0.025: skip
```

**Filter 3 - Momentum threshold**: Reject if price-to-moving-average deviation (strength) is below the minimum, which scales with balance:

| Balance | Min Strength |
|---------|-------------|
| < $2 | 0.80% |
| < $10 | 0.90% |
| < $100 | 1.00% |
| $100+ | 1.20% |

**Filter 4 - Trend consistency**: Require at least 5 rising bars out of the last 10.

**Filter 5 - Dual MA confirmation**: Current price must be above the 20-bar moving average.

**Filter 6 - Momentum continuity**: The previous bar must also show positive strength.

The asset with the highest strength score that passes all filters is selected for entry.

### 1.3 Position Sizing

Position size scales down as balance grows, preventing runaway compounding and managing drawdown risk:

| Balance | Size % |
|---------|--------|
| < $10 | 65% |
| < $100 | 50% |
| < $10,000 | 35% |
| < $1M | 25% |
| < $100M | 15% |
| $100M+ | 10% |

Size is denominated in shares: `shares = (balance * sizePercent) / entryPrice`

This is equivalent to fractional Kelly at varying fractions — aggressive when small (maximizing growth), conservative when large (protecting capital).

### 1.4 Exit Rules

Three exit conditions are checked each tick while a position is open:

**Stop loss**: Exit if `currentPrice <= entry * 0.983` (-1.7%). Loss is floored at $0.50 to prevent ruin.

**Take profit**: Exit if `currentPrice >= entry * 1.05` (+5%).

**Trailing stop**: If position is up >2%, ratchet stop to `max(stop, currentPrice * 0.97)`. This locks in 3% minimum gain once in profit.

The asymmetric R:R ratio is 5:1.7 (~3:1) by design. Combined with a target win rate of 70%+, this produces positive expected value per trade.

### 1.5 Expected Value Per Trade

```
EV = (winRate * reward) - (lossRate * risk)
EV = (0.70 * 5%) - (0.30 * 1.7%)
EV = 3.5% - 0.51% = +2.99% per trade
```

---

## 2. Monte Carlo Engine

### 2.1 Geometric Brownian Motion

Each simulated price path follows the GBM SDE discretized over daily steps:

```
S(t+dt) = S(t) * exp((mu - 0.5*sigma^2) * dt + sigma * sqrt(dt) * Z)
```

Where:
- `S(t)` = price at time t
- `mu` = annualized drift
- `sigma` = annualized volatility (optionally scaled by `volMult`)
- `dt = 1/365` (daily step)
- `Z ~ N(0,1)` drawn from Box-Muller transform

### 2.2 Box-Muller Transform

Standard normals are generated from a seeded pseudo-random source using Box-Muller:

```javascript
// Seeded random (Wang hash approximation)
sRand(s) = frac(sin(s + 1) * 10000)

// Box-Muller
u = max(0.0001, sRand(s))
Z = sqrt(-2 * ln(u)) * cos(2*pi * sRand(s + 0.5))
```

The seed is a function of `(simSeed, pathIndex, day)` making results reproducible.

### 2.3 Simulation Parameters

- **Paths (N)**: 5,000
- **Horizon**: User-configurable (default 30 days, multi-horizon supported)
- **Output**: 5th, 50th, 95th percentile bands across all paths

### 2.4 Probability Estimates

For each target price and horizon, two probability estimates are computed:

**Monte Carlo probability**:
```
P_mc = count(finalPrice >= target) / N
```

**Black-Scholes probability** (d2 term only):
```
d2 = [ln(S/K) + (r - 0.5*sigma^2)*T] / (sigma * sqrt(T))
P_bs = N(d2)
```

Where `r = 0.045` (assumed risk-free rate), and `N()` is the normal CDF.

### 2.5 Normal CDF Approximation

The Abramowitz & Stegun rational approximation (maximum error < 7.5e-8):

```
t = 1 / (1 + 0.3275911 * |x| / sqrt(2))
erf_approx = 1 - ((((1.061405429*t - 1.453152027)*t + 1.421413741)*t - 0.284496736)*t + 0.254829592) * t * exp(-x^2/2)
N(x) = 0.5 * (1 + sign(x) * erf_approx)
```

---

## 3. Kelly Criterion

Position sizing for prediction market bets uses a fractional Kelly formula:

```
f* = (b*p - q) / b
f_applied = min(f* * 0.25, 0.10)
```

Where:
- `b = odds - 1` (net odds)
- `p` = estimated win probability
- `q = 1 - p`
- Factor of 0.25 = quarter-Kelly (reduces variance, improves long-run survival)
- Hard cap of 10% of bankroll per bet

Quarter-Kelly is used deliberately. Full Kelly maximizes long-run geometric growth in theory, but variance is extreme. Quarter-Kelly cuts variance by ~75% while keeping ~75% of the growth rate.

---

## 4. Prediction Market Edge Detection

For each Polymarket contract, edge is computed relative to a coin flip:

```
yesProb = outcomePrices[0]
noProb  = outcomePrices[1]
edge    = max(yesProb, noProb) - 0.50
side    = argmax(yesProb, noProb)
hasEdge = edge > 0.40  // >90% implied probability
```

A market flagged as `hasEdge = true` represents a near-certainty outcome where the market is pricing in a probability > 90%. These are candidates for capital deployment using the Kelly formula above.

---

## 5. Fibonacci Extension Levels

The simulator uses Fibonacci extension levels as portfolio milestones:

```
range = high52 - low52
fib_N = spot + range * ratio
```

| Ratio | Level |
|-------|-------|
| 0.236 | Fib 23.6% |
| 0.382 | Fib 38.2% |
| 0.500 | Fib 50.0% |
| 0.618 | Golden Ratio |
| 0.786 | Fib 78.6% |
| 1.000 | 100% extension |
| 1.272 | Fib 127.2% |
| 1.618 | Golden Extension |

In the simulator context, these are adapted as balance checkpoints: $1 → $1.618 → $2.618 → $4.236 → ... → $1B, matching Fibonacci sequence scaling.

---

## 6. Delta-Threshold Update Algorithm

To minimize bandwidth and render cost, the dashboard only re-renders when a price moves beyond a threshold:

```
update = |P_curr - P_prev| / P_prev > delta
```

Where `delta = 0.5%`. This reduces unnecessary renders by ~80% during low-volatility sessions.

- **Memory**: O(n) where n = tracked assets (one stored price per asset)
- **Check cost**: O(1) per asset per tick
- **Render cost**: O(k) where k << n (only changed assets re-render)

---

## 7. Data Pipeline

```
Vercel Cron (08:00 UTC daily)
    |
    +-- Polymarket API  → 50 markets by 24h volume
    +-- Yahoo Finance   → 24 stocks + 11 commodities
    +-- CoinGecko       → BTC + ETH spot
    |
    v
Vercel Blob Storage (~50KB JSON)
    |
    v
/api/latest endpoint (<100ms p50 latency)
    |
    v
React client (5-min refresh + Delta-Threshold updates)
```

Fallback: If the Blob cache is > 24 hours old, the client falls back to direct API calls with a staleness warning.

---

## 8. Binary Payload Format (Planned)

Current payloads are JSON (~100 bytes/asset). Target binary format:

```
[timestamp: 4 bytes uint32]
[price: 4 bytes float32]
[volume: 4 bytes uint32]
[change%: 2 bytes int16 (basis points)]
= 14 bytes per asset vs ~100 bytes JSON
```

7x bandwidth reduction. Implementation planned for Phase 3.

---

## 9. Monetization

Rise operates on a freemium model.

**Free tier**: All simulation, Monte Carlo, prediction market, and live data features. No account required.

**Pro tier ($49/month)**:
- cTrader auto-trading integration (CFD execution from sim signals)
- TradingView webhook receiver (alert-to-order pipeline)
- Priority API access (dedicated rate limit pool)

The free tier is intentionally complete. Pro is for users who want to act on signals in real markets, not just observe them.

---

## 10. Architecture Targets

| Metric | Target | Current (Feb 2026) |
|--------|--------|---------------------|
| Bundle size | <500KB | 233KB |
| Runtime memory | <10MB | ~177KB |
| API latency | <100ms | ~200ms |
| Tick rate | 50ms | 50ms |
| Monte Carlo (5K paths) | <500ms | <200ms |

---

## 11. Future Work

- **Black-Scholes options pricer**: Full options chain with Greeks (delta, gamma, theta, vega)
- **Historical backtesting**: Replay real OHLCV data through the simulator entry logic
- **C++ core via WASM**: 10x Monte Carlo speedup, sub-millisecond path generation
- **WebSocket feeds**: Replace polling with streaming tick data
- **Kalshi integration**: US-regulated prediction markets alongside Polymarket

---

## Disclaimer

Rise is a simulation and research tool. Nothing in this document or the software constitutes financial advice. All simulations use synthetic price data. Past simulated performance does not predict real market outcomes.

---

MIT License | Built by Joshua Trommel | Not financial advice
