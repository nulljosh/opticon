import { parseSymbols, setStockResponseHeaders, YAHOO_HEADERS } from './stocks-shared.js';

const YAHOO_PROVIDERS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BASE_MS = 250;
const ENABLE_CACHE = process.env.NODE_ENV !== 'test';
const CACHE_TTL_MS = 30000;
const cache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCached(cacheKey) {
  if (!ENABLE_CACHE) return null;
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.ts) > CACHE_TTL_MS) return null;
  return cached.data;
}

async function fetchQuotes(symbolList) {
  const symbols = symbolList.join(',');
  let lastError = new Error('No providers attempted');

  for (const provider of YAHOO_PROVIDERS) {
    const url = `${provider}/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow`;

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          headers: YAHOO_HEADERS,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Yahoo Finance API returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const results = data?.quoteResponse?.result;
        if (!Array.isArray(results)) {
          throw new Error('Invalid response format: expected quoteResponse.result array');
        }
        return results;
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
  const cached = getCached(cacheKey);
  if (cached) {
    setStockResponseHeaders(res);
    return res.status(200).json(cached);
  }

  try {
    const results = await fetchQuotes(symbolList);

    const stocks = results
      .filter(q => q.symbol && typeof q.regularMarketPrice === 'number')
      .map(q => ({
        symbol: q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
      }));

    if (ENABLE_CACHE) {
      cache.set(cacheKey, { ts: Date.now(), data: stocks });
    }

    setStockResponseHeaders(res);
    return res.status(200).json(stocks);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        details: 'Yahoo Finance did not respond in time across providers',
      });
    }
    return res.status(500).json({
      error: 'Failed to fetch stock data',
      details: err.message,
    });
  }
}
