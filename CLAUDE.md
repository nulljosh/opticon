# Rise - Claude Development Guide

## ⚠️ DEPLOYMENT REMINDER
**IMPORTANT:** When testing deployments, check the RIGHT URL:
- **Vercel (Primary):** https://rise-production.vercel.app/ (production)
- **GitHub Pages:** https://heyitsmejosh.com/rise/ (static hosting, uses Vercel APIs)

**Don't waste tokens checking GitHub Pages when you mean to check Vercel!**

Note: Individual deployment URLs (rise-xxxxx-nulljosh.vercel.app) change each deploy - use the rise-production.vercel.app alias instead.

---

## Project Vision
Rise is a high-alpha, low-latency financial terminal designed for extreme efficiency. It combines prediction markets (Polymarket, Kalshi) with quantitative simulations and live market data into a unified dashboard optimized for minimal memory footprint and bandwidth usage.

## Architecture Goals
- **Memory**: Target <10MB runtime footprint ("The 10MB Dashboard")
- **Latency**: Sub-100ms data updates via Delta-Threshold algorithm
- **Efficiency**: Binary payloads, vectorized math, O(1) user input
- **Scalability**: Web app → C++ core → Custom RTOS (future)

## Current Stack
- **Frontend**: React + Vite
- **APIs**: Polymarket, Kalshi, Yahoo Finance, News APIs
- **Math**: Monte Carlo, Black-Scholes (auto-parameterized)
- **Deployment**: Vercel

---

## Common Issues

### Localhost Polymarket API Proxy
**Problem:** Markets won't load on localhost but work on Vercel

**Cause:** Vercel deployment has authentication enabled, blocking proxy requests

**Solution:** Update `vite.config.js` to proxy directly to Polymarket API:
```javascript
server: {
  proxy: {
    '/api/markets': {
      target: 'https://gamma-api.polymarket.com',
      changeOrigin: true,
      secure: true,
      rewrite: (path) => '/markets?closed=false&limit=50&order=volume24hr&ascending=false'
    }
  }
}
```

**Note:** This proxy config only works in dev. Production uses Vercel serverless functions in `api/` folder.

---

## Project Permissions

Claude has permission to:
- Read, write, and edit any files in this workspace
- Execute bash commands for development tasks
- Install packages and dependencies (npm, pip, brew, etc.)
- Make git commits and push changes
- Create, modify, and delete files and directories
- Run tests, builds, and development scripts
- Search the web and fetch content for research
- Use any tools available without asking for confirmation

### Communication Style
- Never use emojis unless explicitly requested
- Keep responses concise and technical
- Act as a Senior Quant Developer and stock market professional
- Prioritize code efficiency and performance
- **Be intuitive**: Fix issues proactively as you encounter them
- **Work autonomously**: Make senior-level engineering decisions without asking for every detail
- **Anticipate needs**: If you see a bug or improvement, fix it during related work
- **Clean as you go**: Refactor, optimize, and improve code quality continuously

---

## Skills & Commands

### `/sim` - Run Simulation
Executes Monte Carlo or Black-Scholes simulation with auto-parameterized drift/volatility from live news and market data.

**Usage**: `/sim [TICKER] [MODEL]`
**Example**: `/sim AAPL monte-carlo`

**Implementation**:
- Pulls μ (drift) and σ (volatility) from macro news sentiment
- 5,000 path simulations
- Bull/Base/Bear scenario analysis

---

### `/optimize` - Memory & Bandwidth Optimization
Analyzes and optimizes code for memory footprint and bandwidth usage.

**Usage**: `/optimize [TARGET]`
**Example**: `/optimize api/stocks.js`

**Checks**:
- Binary payload usage
- Vectorized math operations
- Delta-Threshold implementation
- Redundant API calls
- Bundle size impact

---

### `/market` - Add Market Integration
Scaffolds a new prediction market or exchange integration.

**Usage**: `/market [PLATFORM]`
**Example**: `/market kalshi`

**Generates**:
- API client in `api/[platform].js`
- React hook in `src/hooks/use[Platform].js`
- Test suite
- Error handling and rate limiting

---

### `/algo` - Document Algorithm
Creates technical documentation for algorithms suitable for white paper inclusion.

**Usage**: `/algo [NAME]`
**Example**: `/algo delta-threshold`

**Output**:
- Mathematical notation
- Pseudocode
- Complexity analysis
- Trade-offs and optimizations

---

### `/broker` - Broker Integration Plan
Generates integration documentation for connecting to trading platforms.

**Usage**: `/broker [PLATFORM]`
**Example**: `/broker tradingview`

**Covers**:
- API authentication flow
- Order execution pipeline
- Risk management considerations
- Latency and slippage handling
- Regulatory compliance notes

---

### `/stock` - Add Stock Coverage
Adds a new stock ticker to the dashboard with live pricing and historical data.

**Usage**: `/stock [TICKER]`
**Example**: `/stock HIMS`

**Updates**:
- `src/utils/assets.js` with new ticker
- Yahoo Finance API integration
- Monte Carlo asset list

---

### `/test-suite` - Generate Comprehensive Tests
Creates test coverage for a module with edge cases and performance benchmarks.

**Usage**: `/test-suite [MODULE]`
**Example**: `/test-suite api/markets`

**Generates**:
- Unit tests with vitest
- Mock API responses
- Error case coverage
- Performance benchmarks

---

### `/deploy` - Deployment & CI/CD
Prepares and executes deployment pipeline with optimization checks.

**Usage**: `/deploy [ENV]`
**Example**: `/deploy prod`

**Steps**:
1. Run tests
2. Bundle size check (<10MB threshold)
3. Build production assets
4. Deploy to Vercel
5. Smoke test endpoints

---

## Development Workflow

### Starting Development
```bash
npm install
npm run dev
```

### Running Tests
```bash
npm test              # Run all tests
npm run test:ui       # Visual test UI
npm run test:coverage # Coverage report
```

### Committing Changes
```bash
git add .
git commit -m "feat: description"
git push
```

---

## Key Algorithms

### 1. Delta-Threshold Update Algorithm
**Purpose**: Minimize bandwidth by only updating UI when price moves beyond threshold.

**Logic**:
- Track last sent price `P_prev`
- Current price `P_curr`
- Threshold `δ = 0.5%`
- Update only if `|P_curr - P_prev| / P_prev > δ`

**Memory**: O(n) where n = number of tracked assets
**Latency**: O(1) per update check

---

### 2. Auto-Parameterized Monte Carlo
**Purpose**: Zero-input simulations using live market data.

**Parameters**:
- **Drift (μ)**: Derived from macro news sentiment analysis
- **Volatility (σ)**: Calculated from historical price variance
- **Paths**: 5,000 simulations
- **Horizon**: User-configurable (default 30 days)

**Optimization**:
- Vectorized operations (SIMD potential)
- Parallel path computation
- Cached news sentiment (15min TTL)

---

### 3. Binary Payload Compression
**Purpose**: Minimize API response sizes.

**Format**:
```
[timestamp (4 bytes)] [price (4 bytes float)] [volume (4 bytes)] [change% (2 bytes)]
= 14 bytes per data point vs 100+ bytes JSON
```

**Implementation**: Future enhancement (currently JSON)

---

## Real-World Trading Considerations

### API Latency
- **Simulation**: Instant execution
- **Reality**: 50-500ms API round-trip
- **Solution**: Pre-fetch with WebSocket, order book snapshots

### Liquidity & Slippage
- **Simulation**: Fill at mid-price
- **Reality**: Bid-ask spread, partial fills
- **Solution**: Model slippage as `f(volume, spread, volatility)`

### Rate Limits
- **Polymarket**: ~10 req/sec
- **Yahoo Finance**: ~2,000 req/hour
- **Solution**: Delta-Threshold + caching

### Paper Trading → Live
1. Test with paper trading API (TD Ameritrade, Alpaca)
2. Implement order confirmation UX
3. Add kill switch and position limits
4. Gradual capital allocation ($100 → $1k → ...)

---

## S&P 500 Coverage Plan

### Memory Budget Analysis
- **Per Stock**: ~100 bytes (ticker, price, change, volume)
- **500 Stocks**: ~50KB base
- **Historical (1Y)**: 252 days × 500 × 14 bytes = ~1.8MB
- **Total**: ~2MB for full S&P 500 coverage

### Implementation Strategy
1. **Phase 1**: Add MAG7 + requested stocks (HIMS, PG, TGT, WMT)
2. **Phase 2**: Top 50 by market cap
3. **Phase 3**: Full S&P 500 with virtualized rendering
4. **Phase 4**: Custom stock input with symbol validation

---

## Broker Integration Roadmap

### TradingView Integration
- **Approach**: TradingView Webhooks → Rise API → Broker
- **Flow**: Alert trigger → REST endpoint → Order execution
- **Latency**: ~500ms end-to-end

### cTrader Integration
- **Approach**: cTrader Open API (REST + WebSocket)
- **Features**: Real-time quotes, order management, historical data
- **Use Case**: Forex and CFDs

### Wealthsimple Trade
- **Status**: No public API (as of 2025)
- **Alternative**: Screen scraping (unreliable) or wait for official API
- **Recommended**: Use IBKR, Alpaca, or Tradier instead

### Interactive Brokers (Recommended)
- **API**: TWS API (most robust)
- **Features**: Stocks, options, futures, forex, crypto
- **Latency**: Sub-50ms market data
- **Liquidity**: Direct market access

---

## Future Enhancements

### Phase 1: Current (Web App)
- React dashboard
- API integrations
- Basic simulations

### Phase 2: C++ Core
- Rewrite compute-heavy modules (Monte Carlo, data processing)
- WebAssembly bridge to React frontend
- 10x performance improvement

### Phase 3: Custom RTOS
- Bare-metal financial operating system
- <5MB memory footprint
- Sub-millisecond tick-to-trade
- Custom kernel for order routing

### Phase 4: White Paper
- Publish algorithms and optimizations
- Academic validation of models
- Open-source efficiency techniques

---

## Meme Culture

**Nothing Ever Happens**:
- UI should only alert when macro events ACTUALLY break the status quo
- Silent by default
- Big bold alerts for >3% market moves
- "Something happened" banner when VIX spikes

---

## Technical Debt & TODOs

See [TODO.md](TODO.md) for the unified prioritized backlog.

---

## UI Skills

Opinionated constraints for building better interfaces with agents.

### Stack
- MUST use Tailwind CSS defaults (spacing, radius, shadows) before custom values
- MUST use `motion/react` (formerly `framer-motion`) when JavaScript animation is required
- SHOULD use `tw-animate-css` for entrance and micro-animations in Tailwind CSS
- MUST use `cn` utility (`clsx` + `tailwind-merge`) for class logic

### Components
- MUST use accessible component primitives for anything with keyboard or focus behavior (`Base UI`, `React Aria`, `Radix`)
- MUST use the project's existing component primitives first
- NEVER mix primitive systems within the same interaction surface
- SHOULD prefer [`Base UI`](https://base-ui.com/react/components) for new primitives if compatible with the stack
- MUST add an `aria-label` to icon-only buttons
- NEVER rebuild keyboard or focus behavior by hand unless explicitly requested

### Interaction
- MUST use an `AlertDialog` for destructive or irreversible actions
- SHOULD use structural skeletons for loading states
- NEVER use `h-screen`, use `h-dvh`
- MUST respect `safe-area-inset` for fixed elements
- MUST show errors next to where the action happens
- NEVER block paste in `input` or `textarea` elements

### Animation
- NEVER add animation unless it is explicitly requested
- MUST animate only compositor props (`transform`, `opacity`)
- NEVER animate layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`)
- SHOULD avoid animating paint properties (`background`, `color`) except for small, local UI (text, icons)
- SHOULD use `ease-out` on entrance
- NEVER exceed `200ms` for interaction feedback
- MUST pause looping animations when off-screen
- MUST respect `prefers-reduced-motion`
- NEVER introduce custom easing curves unless explicitly requested
- SHOULD avoid animating large images or full-screen surfaces

### Typography
- MUST use `text-balance` for headings and `text-pretty` for body/paragraphs
- MUST use `tabular-nums` for data
- SHOULD use `truncate` or `line-clamp` for dense UI
- NEVER modify `letter-spacing` (`tracking-`) unless explicitly requested

### Layout
- MUST use a fixed `z-index` scale (no arbitrary `z-x`)
- SHOULD use `size-x` for square elements instead of `w-x` + `h-x`

### Performance
- NEVER animate large `blur()` or `backdrop-filter` surfaces
- NEVER apply `will-change` outside an active animation
- NEVER use `useEffect` for anything that can be expressed as render logic

### Design
- NEVER use gradients unless explicitly requested
- NEVER use purple or multicolor gradients
- NEVER use glow effects as primary affordances
- SHOULD use Tailwind CSS default shadow scale unless explicitly requested
- MUST give empty states one clear next action
- SHOULD limit accent color usage to one per view
- SHOULD use existing theme or Tailwind CSS color tokens before introducing new ones

**Source**: [ui-skills.com](https://ui-skills.com)

---

## Philosophy & Soul

### The 10MB Dashboard

> "Build fast, not bloated."

Most financial terminals are slow, bloated, and expensive:
- **Bloomberg Terminal**: $24,000/year, 100MB+ memory, ugly UI
- **MetaTrader**: 200MB+ install, cluttered interface, Windows-only
- **TradingView**: 50MB+ page load, slow charts, premium paywalls

Rise is different:
- **Memory**: <10MB runtime footprint
- **Bundle**: 233KB (target <200KB)
- **Speed**: Sub-60s to run $1 → $1B simulation
- **Cost**: Free, open source

**The constraint is the point.** Every feature must justify its bytes.

### Core Philosophy

**1. Speed is Sacred**
Latency kills alpha. Every millisecond between signal and execution is money left on the table.

- 50ms tick rate (Bloomberg: 250ms)
- Delta-Threshold updates (only render on >0.5% moves)
- Vectorized Monte Carlo (SIMD-optimized)
- Binary payloads (14 bytes vs 100+ bytes JSON)

**2. Nothing Ever Happens**
Markets are boring 95% of the time. UI should reflect this.

- Silent by default
- Only alert on >3% moves
- Big red banner when VIX spikes
- Contrarian mindset (fade the hype)

**3. Education Over Gambling**
Rise is a simulator, not a casino.

- Show win rate, max drawdown, stopped out count
- No gamified losses or "try again" dopamine
- Full transparency on trade history
- Encourage patience over overtrading

**4. Transparency**
Code is open source. Algorithms are documented. No black boxes.

---

## Vercel Blob Caching

### Overview
Rise uses Vercel Blob Storage to cache market data for fast retrieval and reduced API load.

**Architecture:**
- **Cron job** (`/api/cron`) — Runs daily at 8 AM UTC
- **Latest endpoint** (`/api/latest`) — Serves cached data with <100ms latency
- **Client** — Fetches from latest endpoint on app load

### Setup

**Environment Variables:**
```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
CRON_SECRET=your_random_secret
```

**Getting tokens:**
1. **BLOB_READ_WRITE_TOKEN:** Vercel dashboard → Settings → Tokens → "Blob Read/Write"
2. **CRON_SECRET:** Generate with `openssl rand -hex 32`

### Data Flow

```
Vercel Cron (8 AM UTC)
    ↓
/api/cron handler
    ↓
Fetch in parallel:
  - Polymarket (markets)
  - Yahoo Finance (stocks)
  - Yahoo Finance (commodities)
  - CoinGecko (crypto)
    ↓
Upload to Vercel Blob
    ↓
Client calls /api/latest
    ↓
Returns cached data
```

### Data Sources

**Markets (Polymarket)**
- 50 most-traded prediction markets
- Updated: Daily via cron

**Stocks (Yahoo Finance)**
- 24 major stocks + commodities
- Fields: price, change, changePercent, volume
- Updated: Daily via cron, live updates every 5 min in app

**Commodities (Yahoo Finance)**
- 11 commodities & indices (Gold, Oil, S&P 500, etc.)
- Updated: Daily via cron

**Crypto (CoinGecko)**
- Bitcoin & Ethereum spot prices
- Free API, no auth required
- Updated: Daily via cron, live updates every 5 min

### Monitoring

**Check cache age:**
```javascript
fetch('/api/latest')
  .then(r => r.json())
  .then(data => {
    const age = new Date() - new Date(data.data.updatedAt);
    console.log(`Cache age: ${age / 1000 / 60} minutes`);
  });
```

**Performance targets:**
- Fetch: <3000ms
- Upload: <500ms
- Total: <5000ms

### Error Handling

- Automatic retries (up to 2 per source)
- Graceful degradation (if one source fails, others still work)
- Client fallback (use old cache if >24h old, show warning)

### Costs

**Vercel Blob Storage:**
- First 10 GB: Free
- Rise usage: ~50KB cache file, 1 write/day
- **Cost:** Essentially free (within free tier)

---

## Known Issues

### Ticker Data Accuracy Issue

**Problem:** Stock prices showing as outdated

**Root Cause:** Yahoo Finance API returning 401 Unauthorized (as of Feb 13, 2026)

**Current Status:**
- API failing with 401, falling back to hardcoded data from Feb 6, 2026
- Fallback data is 7+ days old

**Solutions:**
1. **Fix Yahoo Finance API** - Add proper cookies/headers
2. **Alternative API** (Recommended) - Financial Modeling Prep (250 free req/day)
3. **Update Fallback** (Band-aid) - Manually update prices in `src/hooks/useStocks.js`

**Quick Fix Created:**
- Added `api/stocks-fmp.js` as alternative endpoint
- Requires FMP_API_KEY env var on Vercel
- To use: Change `useStocks` hook to call `/api/stocks-fmp`

---

**Last Updated**: 2026-02-14
