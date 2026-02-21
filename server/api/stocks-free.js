// 100% FREE stock API using Yahoo Finance Chart API (no key needed)
// Fetches per-symbol with query1/query2 fallback and per-symbol timeout
import { parseSymbols, setStockResponseHeaders, YAHOO_HEADERS } from './stocks-shared.js';

const YAHOO_URLS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];
const REQUEST_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BASE_MS = 200;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const CACHE_TTL_MS = 45000;
const STALE_IF_ERROR_MS = 5 * 60 * 1000;
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCached(cacheKey, maxAgeMs) {
  if (!ENABLE_CACHE) return null;
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > maxAgeMs) return null;
  return cached.data;
}

async function fetchSymbol(symbol) {
  for (const base of YAHOO_URLS) {
    const url = `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(url, { signal: controller.signal, headers: YAHOO_HEADERS });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`Yahoo ${base} error for ${symbol}: ${response.status}`);
          continue;
        }

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
        };
      } catch (err) {
        console.warn(`Fetch error for ${symbol} at ${base} (attempt ${attempt + 1}): ${err.message}`);
      }

      if (attempt < MAX_ATTEMPTS_PER_PROVIDER - 1) {
        const delay = process.env.NODE_ENV === 'test' ? 0 : RETRY_BASE_MS * (2 ** attempt);
        await sleep(delay);
      }
    }
  }
  return null; // all attempts failed
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
    setStockResponseHeaders(res);
    return res.status(200).json(freshCached);
  }

  try {
    const results = await Promise.all(symbolList.map(fetchSymbol));
    const stocks = results.filter(r => r !== null);

    if (stocks.length === 0) {
      const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
      if (staleCached) {
        setStockResponseHeaders(res);
        return res.status(200).json(staleCached);
      }
      return res.status(500).json({ error: 'No valid stock data received' });
    }

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: stocks });
    }

    setStockResponseHeaders(res);
    return res.status(200).json(stocks);
  } catch (err) {
    console.error('stocks-free handler error:', err);
    const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
    if (staleCached) {
      setStockResponseHeaders(res);
      return res.status(200).json(staleCached);
    }
    return res.status(500).json({ error: 'Failed to fetch stock data', details: err.message });
  }
}
