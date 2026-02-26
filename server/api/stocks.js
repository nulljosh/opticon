// Premium stock API: FMP batch (primary) + Yahoo v7 quote (fallback)
import { parseSymbols, setStockResponseHeaders, YAHOO_HEADERS, FMP_BASE, getFmpApiKey } from './stocks-shared.js';

const YAHOO_PROVIDERS = process.env.NODE_ENV === 'test'
  ? ['https://query1.finance.yahoo.com']
  : ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS_PER_PROVIDER = process.env.NODE_ENV === 'test' ? 1 : 2;
const RETRY_BASE_MS = 250;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const CACHE_TTL_MS = 90000; // 90s for FMP quota management
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

// FMP batch quote
async function fetchFmpQuotes(symbolList) {
  const apiKey = getFmpApiKey();
  if (!apiKey) return null;

  const fmpSymbols = symbolList.map(s => s.replace('-', '.'));
  const url = `${FMP_BASE}/quote/${fmpSymbols.join(',')}?apikey=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    const yahooSymbolMap = {};
    symbolList.forEach(s => { yahooSymbolMap[s.replace('-', '.')] = s; });

    return data
      .filter(q => q.symbol && typeof q.price === 'number')
      .map(q => ({
        symbol: yahooSymbolMap[q.symbol] || q.symbol,
        price: q.price,
        change: q.change ?? 0,
        changePercent: q.changesPercentage ?? 0,
        volume: q.volume ?? 0,
        fiftyTwoWeekHigh: q.yearHigh ?? null,
        fiftyTwoWeekLow: q.yearLow ?? null,
      }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`FMP quote error: ${err.message}`);
    return null;
  }
}

// Yahoo v7 quote fallback
async function fetchYahooQuotes(symbolList) {
  const symbols = symbolList.join(',');
  let lastError = new Error('No providers attempted');

  for (const provider of YAHOO_PROVIDERS) {
    const url = `${provider}/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow`;

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
      const controller = new AbortController();
      let timeoutId;

      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            const timeoutError = new Error('Request timeout');
            timeoutError.name = 'TimeoutError';
            reject(timeoutError);
          }, TIMEOUT_MS);
        });

        const response = await Promise.race([
          fetch(url, {
            headers: YAHOO_HEADERS,
            signal: controller.signal,
          }),
          timeoutPromise,
        ]);

        if (!response.ok) {
          throw new Error(`Yahoo Finance API returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const results = data?.quoteResponse?.result;
        if (!Array.isArray(results)) {
          throw new Error('Invalid response format: expected quoteResponse.result array');
        }
        return results.map(q => ({
          symbol: q.symbol,
          price: q.regularMarketPrice,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          volume: q.regularMarketVolume ?? 0,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
        }));
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS_PER_PROVIDER - 1) {
          const delay = process.env.NODE_ENV === 'test' ? 0 : RETRY_BASE_MS * (2 ** attempt);
          await sleep(delay);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  throw lastError;
}

export default async function handler(req, res) {
  const parsed = parseSymbols(req.query.symbols, {
    max: 50,
    validate: true,
    tooManyMessage: 'Too many symbols',
  });
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { symbolList } = parsed;
  const cacheKey = symbolList.join(',');
  const cached = getCached(cacheKey, CACHE_TTL_MS);
  if (cached) {
    setStockResponseHeaders(req, res);
    res.setHeader('X-Opticon-Data-Status', 'cache');
    return res.status(200).json(cached);
  }

  try {
    // Try FMP first
    let stocks = await fetchFmpQuotes(symbolList);
    let source = 'fmp';

    // Fallback to Yahoo if FMP fails
    if (!stocks || stocks.length === 0) {
      stocks = await fetchYahooQuotes(symbolList);
      source = 'yahoo';
    }

    stocks = stocks.filter(q => q.symbol && typeof q.price === 'number');

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: stocks });
    }

    setStockResponseHeaders(req, res);
    res.setHeader('X-Opticon-Data-Status', 'live');
    res.setHeader('X-Opticon-Data-Source', source);
    return res.status(200).json(stocks);
  } catch (err) {
    const staleCached = getCached(cacheKey, STALE_IF_ERROR_MS);
    if (staleCached) {
      setStockResponseHeaders(req, res);
      res.setHeader('X-Opticon-Data-Status', 'stale');
      return res.status(200).json(staleCached);
    }

    if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message === 'Request timeout') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'APIs did not respond in time across providers',
      });
    }
    return res.status(500).json({
      error: 'Failed to fetch stock data',
      details: err.message,
    });
  }
}
