// Stock API: FMP batch quotes (primary) + Yahoo Finance chart (fallback)
// FMP handles up to 100 symbols in one batch call
import { parseSymbols, setStockResponseHeaders, YAHOO_HEADERS, FMP_BASE, getFmpApiKey } from './stocks-shared.js';

const YAHOO_URLS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];
const REQUEST_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BASE_MS = 200;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const CACHE_TTL_MS = 90000; // 90s to stay within FMP 250/day free tier
const STALE_IF_ERROR_MS = 5 * 60 * 1000;
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function chunkedFetch(items, fetchFn, batchSize = 10, delayMs = 100) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fetchFn));
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  return results;
}

function getCached(cacheKey, maxAgeMs) {
  if (!ENABLE_CACHE) return null;
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > maxAgeMs) return null;
  return cached.data;
}

// FMP batch quote: single call for all symbols
async function fetchFmpBatch(symbolList) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return null;

  // FMP uses dots for BRK.B style, Yahoo uses BRK-B. Convert.
  const fmpSymbols = symbolList.map(s => s.replace('-', '.'));
  const url = `${FMP_BASE}/quote/${fmpSymbols.join(',')}?apikey=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`FMP batch error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // Map FMP symbols back to Yahoo-style (BRK.B -> BRK-B)
    const yahooSymbolMap = {};
    symbolList.forEach(s => {
      yahooSymbolMap[s.replace('-', '.')] = s;
    });

    return data
      .filter(q => q.symbol && typeof q.price === 'number')
      .map(q => ({
        symbol: yahooSymbolMap[q.symbol] || q.symbol,
        price: q.price,
        change: q.change ?? 0,
        changePercent: q.changesPercentage ?? 0,
        volume: q.volume ?? 0,
        high: q.dayHigh ?? q.price,
        low: q.dayLow ?? q.price,
        open: q.open ?? q.previousClose ?? q.price,
        prevClose: q.previousClose ?? q.price,
        fiftyTwoWeekHigh: q.yearHigh ?? null,
        fiftyTwoWeekLow: q.yearLow ?? null,
        source: 'fmp',
      }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`FMP batch fetch error: ${err.message}`);
    return null;
  }
}

// Yahoo fallback: per-symbol chart endpoint
async function fetchYahooSymbol(symbol) {
  for (const base of YAHOO_URLS) {
    const url = `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (!result) continue;

        const meta = result.meta;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose;

        if (typeof price !== 'number' || typeof prevClose !== 'number' || prevClose === 0) continue;

        const change = price - prevClose;
        const changePercent = (change / prevClose) * 100;

        return {
          symbol,
          price,
          change,
          changePercent,
          volume: meta.regularMarketVolume ?? 0,
          high: meta.regularMarketDayHigh ?? price,
          low: meta.regularMarketDayLow ?? price,
          open: meta.regularMarketOpen ?? prevClose,
          prevClose,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
          source: 'yahoo',
        };
      } catch (err) {
        // retry
      }

      if (attempt < MAX_ATTEMPTS_PER_PROVIDER - 1) {
        const delay = process.env.NODE_ENV === 'test' ? 0 : RETRY_BASE_MS * (2 ** attempt);
        await sleep(delay);
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  const parsed = parseSymbols(req.query.symbols, { max: 100, validate: false });
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { symbolList } = parsed;
  const cacheKey = symbolList.join(',');

  const freshCached = getCached(cacheKey, CACHE_TTL_MS);
  if (freshCached) {
    setStockResponseHeaders(req, res);
    res.setHeader('X-Opticon-Data-Status', 'cache');
    return res.status(200).json(freshCached);
  }

  try {
    // Try FMP batch first (single API call for all symbols)
    let stocks = await fetchFmpBatch(symbolList);
    let source = 'fmp';

    // Fallback to Yahoo per-symbol if FMP fails or returns too few
    if (!stocks || stocks.length < symbolList.length * 0.5) {
      console.warn(`FMP returned ${stocks?.length ?? 0}/${symbolList.length}, falling back to Yahoo`);
      const fmpMap = {};
      if (stocks) stocks.forEach(s => { fmpMap[s.symbol] = s; });

      const missing = symbolList.filter(s => !fmpMap[s]);
      const yahooResults = await chunkedFetch(missing, fetchYahooSymbol, 10, 100);
      const yahooStocks = yahooResults.filter(r => r !== null);

      stocks = [...Object.values(fmpMap), ...yahooStocks];
      source = stocks.length > 0 ? 'mixed' : 'none';
    }

    if (!stocks || stocks.length === 0) {
      const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
      if (staleCached) {
        setStockResponseHeaders(req, res);
        res.setHeader('X-Opticon-Data-Status', 'stale');
        return res.status(200).json(staleCached);
      }
      return res.status(500).json({ error: 'No valid stock data received' });
    }

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: stocks });
    }

    setStockResponseHeaders(req, res);
    res.setHeader('X-Opticon-Data-Status', 'live');
    res.setHeader('X-Opticon-Data-Source', source);
    return res.status(200).json(stocks);
  } catch (err) {
    console.error('stocks-free handler error:', err);
    const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
    if (staleCached) {
      setStockResponseHeaders(req, res);
      res.setHeader('X-Opticon-Data-Status', 'stale');
      return res.status(200).json(staleCached);
    }
    return res.status(500).json({ error: 'Failed to fetch stock data', details: err.message });
  }
}
