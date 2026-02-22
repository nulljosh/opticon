import { applyCors } from './_cors.js';
export const DEFAULT_SYMBOLS = 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA';

export const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

export const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

export function getFmpApiKey() {
  return process.env.FMP_API_KEY || '';
}

export function parseSymbols(raw, { max = 50, validate = false, tooManyMessage } = {}) {
  const symbolList = (raw || DEFAULT_SYMBOLS)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (validate && symbolList.some(s => !/^[A-Za-z0-9.\-=^]+$/.test(s))) {
    return { error: 'Invalid symbols format' };
  }

  if (symbolList.length > max) {
    return { error: tooManyMessage || `Too many symbols${max === 100 ? ' (max 100)' : ''}` };
  }

  return { symbolList };
}

export function setStockResponseHeaders(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
}
