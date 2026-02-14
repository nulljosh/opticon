# Ticker Data Accuracy Issue

**Problem:** Ticker showing outdated stock prices

**Root Cause:** Yahoo Finance API returning 401 Unauthorized (as of Feb 13, 2026)

**Current Status:**
- Ticker uses `useStocks()` hook → `/api/stocks` → Yahoo Finance API
- API failing with 401, falling back to hardcoded data from Feb 6, 2026
- Fallback data is 7+ days old

**Solutions:**

### Option 1: Fix Yahoo Finance API (Quick)
Yahoo Finance changed authentication requirements. Need to:
1. Add proper cookies/headers to API request
2. Or use yfinance Python library with updated session handling

### Option 2: Alternative API (Recommended)
Replace with:
- **Financial Modeling Prep** - 250 free requests/day, reliable
- **Alpha Vantage** - 25 requests/day free (too limited)
- **Twelve Data** - 800 requests/day free tier

### Option 3: Update Fallback Data (Band-aid)
Manually update FALLBACK_DATA in `src/hooks/useStocks.js` with current prices
- Pros: Instant fix
- Cons: Still stale after hours/weekends, needs manual updates

**Recommended Fix:** 
Implement Financial Modeling Prep API as primary source, keep Yahoo as fallback.

**Files to update:**
- `api/stocks.js` - Add FMP endpoint
- `src/hooks/useStocks.js` - Update fetch logic
- `src/hooks/useLivePrices.js` - Same for commodities

**Current Impact:**
- Ticker shows prices from ~7 days ago
- Prediction market data still works (Polymarket API separate)
- Trading simulator works (uses random walk, not real prices)
