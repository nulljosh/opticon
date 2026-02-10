# Bread Blob Caching System

Complete guide to the Vercel Blob caching system for Bread's market data.

## Overview

Bread uses Vercel Blob Storage to cache market data (stocks, commodities, crypto, markets) for fast retrieval and reduced API load.

**Architecture:**
- **Cron job** (`/api/cron`) — Runs daily at 8 AM UTC, fetches all data, saves to blob
- **Latest endpoint** (`/api/latest`) — Serves cached data from blob with minimal latency
- **Client** — Fetches from latest endpoint on app load and periodically

## Setup

### 1. Environment Variables

Add to `.env.local` (Vercel dashboard):

```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
CRON_SECRET=your_random_secret
```

**Getting tokens:**

1. **BLOB_READ_WRITE_TOKEN:**
   - Go to Vercel dashboard → Settings → Tokens
   - Create new "Blob Read/Write" token
   - Copy the full token string

2. **CRON_SECRET:**
   - Generate a secure random string:
   ```bash
   openssl rand -hex 32
   ```
   - Use this value (keep it secret!)

### 2. Vercel Configuration

Already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 8 * * *"
    }
  ]
}
```

This runs the cron job at 8 AM UTC every day.

## How It Works

### 1. Cron Job (`/api/cron`)

**Triggered:** Daily at 8 AM UTC  
**Duration:** ~5-10 seconds  
**Output:** JSON blob in Vercel storage

```
Flow:
Vercel Cron
    ↓
/api/cron handler
    ↓
Fetch in parallel:
  - Polymarket (markets)
  - Yahoo Finance (stocks)
  - Yahoo Finance (commodities)
  - CoinGecko (crypto)
    ↓
Validate & filter data
    ↓
Upload to Vercel Blob
    ↓
Return success with metrics
```

**Request Flow (Vercel → Your API):**

1. Vercel sends authenticated request to `/api/cron`
2. Handler verifies `Authorization: Bearer ${CRON_SECRET}`
3. If valid, begins data fetching
4. If invalid, returns 401

### 2. Latest Endpoint (`/api/latest`)

**Called from:** Browser on app load  
**Response time:** <100ms (from cache)  
**Updated:** Once per day (after cron runs)

```
Flow:
Client
    ↓
GET /api/latest
    ↓
List Vercel Blob storage
    ↓
Fetch blob content
    ↓
Parse JSON
    ↓
Return to client
```

**Response Structure:**

```json
{
  "cached": true,
  "data": {
    "markets": [...],
    "stocks": [...],
    "commodities": {...},
    "crypto": {...},
    "updatedAt": "2026-02-10T08:00:00Z"
  },
  "blobAge": 3600000,
  "blobUrl": "https://blob.vercel-storage.com/..."
}
```

## Data Sources

### Markets (Polymarket)

```javascript
50 most-traded prediction markets
URL: https://gamma-api.polymarket.com/markets
Fields: id, question, slug, volume24hr, ...
Sample: "Will Trump win 2024?"
Updated: Daily (cron)
```

### Stocks (Yahoo Finance)

```javascript
24 major stocks + commodities
Symbols: AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA, ...
Fields: price, change, changePercent, volume
Updated: Daily (cron), every 5 min (live in app)
```

### Commodities (Yahoo Finance)

```javascript
11 commodities & indices
- Metals: Gold, Silver, Platinum, Palladium, Copper
- Energy: Oil, Natural Gas
- Indices: Nasdaq 100, S&P 500, Dow Jones, Dollar Index
Updated: Daily (cron)
```

### Crypto (CoinGecko)

```javascript
Bitcoin & Ethereum
Fields: spot price, 24h change %
Free API (no auth required)
Updated: Daily (cron), every 5 min (live in app)
```

## API Details

### Cron Job (`POST /api/cron`)

**Authentication:** Bearer token (CRON_SECRET)

**Request:**
```bash
curl -X POST https://bread-alpha.vercel.app/api/cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response (Success):**
```json
{
  "ok": true,
  "counts": {
    "markets": 50,
    "stocks": 24,
    "commodities": 11,
    "crypto": 2
  },
  "blobUrl": "https://blob.vercel-storage.com/bread-cache/results.json",
  "updatedAt": "2026-02-10T08:00:00Z",
  "timings": {
    "fetch": 2500,
    "upload": 150,
    "total": 2650
  }
}
```

**Response (Error):**
```json
{
  "ok": false,
  "error": "Network timeout on Polymarket API",
  "totalTime": 2500
}
```

### Latest Endpoint (`GET /api/latest`)

**No authentication required**

**Request:**
```bash
curl https://bread-alpha.vercel.app/api/latest
```

**Response (Cache Hit):**
```json
{
  "cached": true,
  "data": {
    "markets": [...],
    "stocks": [...],
    "commodities": {...},
    "crypto": {...},
    "updatedAt": "2026-02-10T08:00:00.000Z"
  },
  "blobAge": 3600000,
  "blobUrl": "https://blob.vercel-storage.com/bread-cache/results.json"
}
```

**Response (Cache Miss):**
```json
{
  "cached": false,
  "data": null,
  "message": "Cache not available - cron job may not have run yet",
  "timestamp": "2026-02-10T09:30:00.000Z"
}
```

## Monitoring & Debugging

### Check Cron Runs

1. Go to Vercel Dashboard
2. Select your Bread project
3. Click "Cron Jobs" tab
4. See execution history and logs

### Check Cache Age

```javascript
// In browser console
fetch('/api/latest')
  .then(r => r.json())
  .then(data => {
    const age = new Date() - new Date(data.data.updatedAt);
    console.log(`Cache age: ${age / 1000 / 60} minutes`);
  });
```

### View Blob Storage

1. Vercel Dashboard → Storage → Blob
2. See all stored blobs
3. Filter by `bread-cache/`
4. View file size and creation date

### Monitor Performance

The cron job returns timing metrics:

```json
{
  "timings": {
    "fetch": 2500,      // Time to fetch all data
    "upload": 150,      // Time to upload to blob
    "total": 2650       // Total execution time
  }
}
```

**Targets:**
- `fetch`: <3000ms (should complete before Vercel timeout)
- `upload`: <500ms
- `total`: <5000ms

## Error Handling

### Retry Logic

Each data source has automatic retries:
- Initial timeout: 8-15 seconds (varies by source)
- Retry: Up to 2 automatic retries
- Delay: 1 second between retries
- Fallback: Returns empty array if all retries fail

```javascript
// Example: Stocks fetch with 3 attempts
try {
  // Attempt 1
  const res = await timedFetch(url, opts, 10000);
} catch {
  // Attempt 2
  await delay(1000);
  const res = await timedFetch(url, opts, 10000);
}
```

### Graceful Degradation

If one data source fails:

```javascript
const results = {
  markets: [],        // Empty if Polymarket down
  stocks: [...],      // Other sources still work
  commodities: {...},
  crypto: {...},
  updatedAt: "2026-02-10T08:00:00Z" // Still gets updated
};
```

**Client behavior:**
- If cache is recent (<24h old): Use it
- If cache is stale (>24h old): Show warning, use old data
- If no cache exists: Show empty state with error

### Debugging Failed Cron Runs

**In Vercel Logs:**

```
[CRON] Starting cache update...
[CRON] Markets fetched: 48/50 in 1203ms
[CRON] Stocks fetched: 24/24 in 892ms
[CRON] Commodities fetched: 10/11 in 1456ms
[CRON] Blob uploaded in 145ms (total: 3696ms)
```

**Error examples:**

```
[CRON] Markets fetch failed after 15000ms: Network timeout
[CRON] Commodity gold fetch failed: HTTP 429 (rate limit)
[CRON] Stocks fetch failed: HTTP 401 (auth error)
```

## Testing

### Test Cron Job Locally

```bash
# Start dev server
npm run dev

# In another terminal, trigger cron (note: won't actually upload to Vercel)
curl -X POST http://localhost:5173/api/cron \
  -H "Authorization: Bearer test-secret"
```

### Test Latest Endpoint

```bash
curl http://localhost:5173/api/latest
```

### Run Test Suite

```bash
npm test api/cron.test.js
npm test api/latest.test.js
```

## Optimization Tips

### Reduce Cron Duration

**Current optimizations:**
- Parallel fetching (all 4 sources at once)
- Timeout limits (8-15 seconds per source)
- Data filtering (only valid records)

**If still slow:**
1. Reduce ticker count (fewer stocks)
2. Increase timeouts (trade latency for reliability)
3. Split into multiple cron jobs (markets separate from stocks)

### Reduce Cache Size

**Current:** ~50KB (markets + stocks + commodities + crypto)

**To reduce:**
- Filter markets by volume threshold
- Include only top 10 stocks instead of 24
- Remove commodity indices (keep only metals + oil)

### Update Frequency

**Current:** Once per day (8 AM UTC)

**To increase:**
- Vercel Hobby: Cron disabled (upgrade to Pro)
- Vercel Pro: Can set multiple times per day
- Change `vercel.json`:
  ```json
  {
    "schedule": "0 8,14,20 * * *"  // 8 AM, 2 PM, 8 PM UTC
  }
  ```

## Costs

**Vercel Blob Storage (as of 2026):**
- First 10 GB: Free
- Each 1 MB: ~$0.40/month
- Read operations: Free
- Write operations: Included

**Bread usage:**
- Cache file: ~50KB
- Writes: 1 per day
- **Cost:** Essentially free (within free tier)

## Troubleshooting

### "Cache not available - cron job may not have run yet"

**Cause:** First deployment or cron failed

**Solution:**
1. Check Vercel Dashboard → Cron Jobs tab
2. Look for error in logs
3. Wait until next scheduled run (8 AM UTC)
4. Or manually trigger if you have Pro plan

### "Blob fetch returned 404"

**Cause:** Cache file was deleted or blob storage cleared

**Solution:**
1. Wait for next cron run (will recreate)
2. Or manually trigger cron with curl

### Cron job timeout

**Cause:** API is slow or network is poor

**Solution:**
1. Check individual API latencies
2. Increase timeout in cron.js
3. Split fetches into separate cron jobs
4. Consider using webhooks instead of polling

### Cache is stale (>1 day old)

**Cause:** Cron failed but cache wasn't updated

**Solution:**
1. Check Vercel logs for error
2. Fix the issue (auth token, network, API down)
3. Manually trigger cron or wait for next run

## Future Improvements

- [ ] WebSocket updates (push instead of pull)
- [ ] Incremental caching (only update changed data)
- [ ] Multiple cache versions (A/B testing)
- [ ] Analytics dashboard (track data freshness)
- [ ] Fallback to previous cache on cron failure
- [ ] Compression (reduce blob size further)

---

**Questions?** See [README.md](./README.md) or check Vercel Blob docs at https://vercel.com/docs/storage/vercel-blob
