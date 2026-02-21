import { useState, useEffect, useCallback, useRef } from 'react';

// All tradeable stock/ETF symbols across 100-asset universe
// Excludes: indices (handled by commodities.js), meme coins (CoinGecko / not on Yahoo)
// Note: Block Inc rebranded SQ → XYZ (Jan 2025). Berkshire uses BRK-B on Yahoo.
const DEFAULT_SYMBOLS = [
  // MAG7
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  // Large cap US stocks
  'BRK-B', 'LLY', 'V', 'UNH', 'XOM', 'JPM', 'WMT', 'JNJ', 'MA', 'PG',
  'AVGO', 'HD', 'CVX', 'MRK', 'COST', 'ABBV', 'KO', 'PEP', 'AMD', 'ADBE',
  'CRM', 'NFLX', 'CSCO', 'TMO', 'ORCL', 'ACN', 'INTC', 'NKE', 'TXN',
  'QCOM', 'PM', 'DHR', 'INTU', 'UNP', 'RTX', 'HON', 'SPGI',
  // Financials
  'BAC', 'GS', 'MS', 'C', 'WFC', 'BLK', 'SCHW', 'AXP',
  // Healthcare
  'PFE', 'AMGN', 'BMY', 'MDT', 'BSX', 'ELV', 'CVS',
  // Industrials
  'UPS', 'FDX', 'BA', 'CAT', 'DE', 'LMT', 'GE',
  // Media & Telecom
  'DIS', 'CMCSA', 'VZ', 'T', 'TMUS',
  // Utilities
  'NEE', 'DUK', 'SO',
  // Consumer
  'TGT', 'LOW', 'SBUX', 'MCD', 'YUM', 'F', 'GM',
  // REITs & Other
  'AMT', 'PLD', 'CME', 'WM', 'XYZ',
  // Popular / high-vol
  'COIN', 'PLTR', 'HOOD', 'HIMS', 'SHOP', 'RKLB', 'SOFI', 'IBM', 'IWM',
  // Commodity futures
  'GC=F', 'SI=F', 'CL=F',
  // Cramer tracker ETFs + benchmark
  'SPY', 'SJIM', 'LJIM',
];
const STALE_AFTER_MS = 2 * 60 * 1000;

// Retry helper with exponential backoff
const fetchWithRetry = async (url, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1}/${maxRetries} failed:`, err.message);

      if (err.message.includes('400') || err.message.includes('Invalid')) {
        throw err;
      }

      if (i < maxRetries - 1) {
        const delay = process.env.NODE_ENV === 'test' ? 0 : baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// Fallback static data — used only when all live APIs fail (Feb 20, 2026)
const FALLBACK_DATA = {
  // MAG7
  AAPL:   { symbol: 'AAPL',   price: 244.60, changePercent: -0.52 },
  MSFT:   { symbol: 'MSFT',   price: 415.50, changePercent:  0.21 },
  GOOGL:  { symbol: 'GOOGL',  price: 195.80, changePercent: -0.31 },
  AMZN:   { symbol: 'AMZN',   price: 228.40, changePercent:  0.18 },
  NVDA:   { symbol: 'NVDA',   price: 135.60, changePercent: -1.14 },
  META:   { symbol: 'META',   price: 705.20, changePercent:  0.48 },
  TSLA:   { symbol: 'TSLA',   price: 338.40, changePercent: -2.41 },
  // Large cap
  'BRK-B':{ symbol: 'BRK-B', price: 499.80, changePercent:  0.12 },
  LLY:    { symbol: 'LLY',    price: 802.50, changePercent: -0.67 },
  V:      { symbol: 'V',      price: 348.90, changePercent:  0.09 },
  UNH:    { symbol: 'UNH',    price: 514.20, changePercent: -0.43 },
  XOM:    { symbol: 'XOM',    price: 109.30, changePercent:  0.55 },
  JPM:    { symbol: 'JPM',    price: 268.80, changePercent:  0.22 },
  WMT:    { symbol: 'WMT',    price: 98.40,  changePercent: -0.81 },
  JNJ:    { symbol: 'JNJ',    price: 157.20, changePercent:  0.14 },
  MA:     { symbol: 'MA',     price: 552.60, changePercent:  0.07 },
  PG:     { symbol: 'PG',     price: 162.10, changePercent:  0.33 },
  AVGO:   { symbol: 'AVGO',   price: 218.40, changePercent: -0.89 },
  HD:     { symbol: 'HD',     price: 415.30, changePercent:  0.17 },
  CVX:    { symbol: 'CVX',    price: 152.80, changePercent:  0.68 },
  MRK:    { symbol: 'MRK',    price: 94.60,  changePercent: -0.42 },
  COST:   { symbol: 'COST',   price: 1005.40,changePercent: -0.31 },
  ABBV:   { symbol: 'ABBV',   price: 207.30, changePercent:  0.55 },
  KO:     { symbol: 'KO',     price: 63.80,  changePercent:  0.16 },
  PEP:    { symbol: 'PEP',    price: 148.90, changePercent: -0.22 },
  AMD:    { symbol: 'AMD',    price: 117.40, changePercent: -1.88 },
  ADBE:   { symbol: 'ADBE',   price: 432.10, changePercent: -0.44 },
  CRM:    { symbol: 'CRM',    price: 313.60, changePercent:  0.38 },
  NFLX:   { symbol: 'NFLX',   price: 1022.50,changePercent:  0.61 },
  CSCO:   { symbol: 'CSCO',   price: 57.80,  changePercent:  0.09 },
  TMO:    { symbol: 'TMO',    price: 544.20, changePercent: -0.33 },
  ORCL:   { symbol: 'ORCL',   price: 188.60, changePercent:  0.44 },
  ACN:    { symbol: 'ACN',    price: 334.80, changePercent: -0.18 },
  INTC:   { symbol: 'INTC',   price: 21.30,  changePercent: -0.93 },
  NKE:    { symbol: 'NKE',    price: 71.80,  changePercent: -0.28 },
  TXN:    { symbol: 'TXN',    price: 214.50, changePercent:  0.23 },
  QCOM:   { symbol: 'QCOM',   price: 147.20, changePercent: -0.54 },
  PM:     { symbol: 'PM',     price: 137.80, changePercent:  0.36 },
  DHR:    { symbol: 'DHR',    price: 195.40, changePercent: -0.21 },
  INTU:   { symbol: 'INTU',   price: 668.30, changePercent:  0.12 },
  UNP:    { symbol: 'UNP',    price: 237.80, changePercent:  0.08 },
  RTX:    { symbol: 'RTX',    price: 144.60, changePercent:  0.31 },
  HON:    { symbol: 'HON',    price: 214.70, changePercent: -0.14 },
  SPGI:   { symbol: 'SPGI',   price: 466.20, changePercent:  0.27 },
  // Financials
  BAC:    { symbol: 'BAC',    price: 43.80,  changePercent:  0.46 },
  GS:     { symbol: 'GS',     price: 577.40, changePercent:  0.33 },
  MS:     { symbol: 'MS',     price: 131.60, changePercent:  0.19 },
  C:      { symbol: 'C',      price: 74.20,  changePercent:  0.41 },
  WFC:    { symbol: 'WFC',    price: 74.80,  changePercent:  0.27 },
  BLK:    { symbol: 'BLK',    price: 1064.30,changePercent:  0.15 },
  SCHW:   { symbol: 'SCHW',   price: 79.20,  changePercent:  0.51 },
  AXP:    { symbol: 'AXP',    price: 305.60, changePercent:  0.08 },
  // Healthcare
  PFE:    { symbol: 'PFE',    price: 26.20,  changePercent: -0.38 },
  AMGN:   { symbol: 'AMGN',   price: 293.40, changePercent: -0.62 },
  BMY:    { symbol: 'BMY',    price: 57.80,  changePercent:  0.17 },
  MDT:    { symbol: 'MDT',    price: 86.40,  changePercent:  0.23 },
  BSX:    { symbol: 'BSX',    price: 95.10,  changePercent:  0.53 },
  ELV:    { symbol: 'ELV',    price: 374.80, changePercent: -0.91 },
  CVS:    { symbol: 'CVS',    price: 55.30,  changePercent: -0.54 },
  // Industrials
  UPS:    { symbol: 'UPS',    price: 112.40, changePercent: -0.44 },
  FDX:    { symbol: 'FDX',    price: 264.80, changePercent:  0.19 },
  BA:     { symbol: 'BA',     price: 178.60, changePercent:  0.83 },
  CAT:    { symbol: 'CAT',    price: 357.80, changePercent:  0.42 },
  DE:     { symbol: 'DE',     price: 432.10, changePercent: -0.31 },
  LMT:    { symbol: 'LMT',    price: 497.20, changePercent:  0.11 },
  GE:     { symbol: 'GE',     price: 197.40, changePercent:  0.36 },
  // Media & Telecom
  DIS:    { symbol: 'DIS',    price: 106.80, changePercent: -0.56 },
  CMCSA:  { symbol: 'CMCSA',  price: 36.40,  changePercent: -0.27 },
  VZ:     { symbol: 'VZ',     price: 38.20,  changePercent:  0.26 },
  T:      { symbol: 'T',      price: 22.40,  changePercent:  0.18 },
  TMUS:   { symbol: 'TMUS',   price: 258.60, changePercent:  0.44 },
  // Utilities
  NEE:    { symbol: 'NEE',    price: 66.40,  changePercent:  0.61 },
  DUK:    { symbol: 'DUK',    price: 113.20, changePercent:  0.22 },
  SO:     { symbol: 'SO',     price: 79.40,  changePercent:  0.14 },
  // Consumer
  TGT:    { symbol: 'TGT',    price: 127.60, changePercent: -0.31 },
  LOW:    { symbol: 'LOW',    price: 242.30, changePercent:  0.08 },
  SBUX:   { symbol: 'SBUX',   price: 98.40,  changePercent:  0.51 },
  MCD:    { symbol: 'MCD',    price: 296.80, changePercent:  0.17 },
  YUM:    { symbol: 'YUM',    price: 142.60, changePercent: -0.28 },
  F:      { symbol: 'F',      price: 9.48,   changePercent: -0.42 },
  GM:     { symbol: 'GM',     price: 53.20,  changePercent:  0.38 },
  // REITs & Other
  AMT:    { symbol: 'AMT',    price: 202.40, changePercent: -0.33 },
  PLD:    { symbol: 'PLD',    price: 111.80, changePercent:  0.14 },
  CME:    { symbol: 'CME',    price: 235.60, changePercent:  0.09 },
  WM:     { symbol: 'WM',     price: 228.40, changePercent:  0.21 },
  XYZ:    { symbol: 'XYZ',    price: 68.30,  changePercent:  0.44 },
  // Popular
  COIN:   { symbol: 'COIN',   price: 265.80, changePercent:  1.22 },
  PLTR:   { symbol: 'PLTR',   price: 97.40,  changePercent: -2.14 },
  HOOD:   { symbol: 'HOOD',   price: 52.60,  changePercent:  0.77 },
  HIMS:   { symbol: 'HIMS',   price: 34.80,  changePercent:  1.46 },
  SHOP:   { symbol: 'SHOP',   price: 126.40, changePercent:  0.93 },
  RKLB:   { symbol: 'RKLB',   price: 22.80,  changePercent:  3.17 },
  SOFI:   { symbol: 'SOFI',   price: 14.60,  changePercent: -0.68 },
  IBM:    { symbol: 'IBM',    price: 258.40, changePercent:  0.09 },
  IWM:    { symbol: 'IWM',    price: 225.60, changePercent: -0.41 },
  // Commodity futures
  'GC=F': { symbol: 'GC=F',  price: 2942.60, changePercent: 0.38 },
  'SI=F': { symbol: 'SI=F',  price: 32.84,   changePercent: 0.61 },
  'CL=F': { symbol: 'CL=F',  price: 72.40,   changePercent: 0.28 },
  // Cramer tracker ETFs + benchmark
  SPY:    { symbol: 'SPY',   price: 596.80,  changePercent: 0.14 },
  SJIM:   { symbol: 'SJIM',  price: 21.40,   changePercent: 0.31 },
  LJIM:   { symbol: 'LJIM',  price: 20.10,   changePercent: -0.44 },
};

// Parse stock data from either serverless array or Yahoo quoteResponse format
const parseStockData = (raw) => {
  const data = Array.isArray(raw) ? raw : (raw?.quoteResponse?.result ?? []);
  if (!Array.isArray(data) || data.length === 0) return null;

  const stockMap = {};
  data.forEach(s => {
    const symbol = s.symbol;
    const price = s.price ?? s.regularMarketPrice;
    const change = s.change ?? s.regularMarketChange;
    const changePercent = s.changePercent ?? s.regularMarketChangePercent;
    const volume = s.volume ?? s.regularMarketVolume;

    if (symbol && typeof price === 'number') {
      stockMap[symbol] = {
        symbol,
        price,
        change: change ?? 0,
        changePercent: changePercent ?? 0,
        volume: volume ?? 0,
        high52: s.fiftyTwoWeekHigh ?? s.high52 ?? price,
        low52: s.fiftyTwoWeekLow ?? s.low52 ?? price,
      };
    }
  });
  return Object.keys(stockMap).length > 0 ? stockMap : null;
};

export function useStocks(symbols = DEFAULT_SYMBOLS) {
  const [stocks, setStocks] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reliability, setReliability] = useState({
    status: 'fallback',
    source: 'static',
    lastSuccessAt: null,
    lastAttemptAt: null,
  });
  const retryCountRef = useRef(0);
  const seededFromCache = useRef(false);
  const lastLiveSuccessRef = useRef(null);

  const fetchStocks = useCallback(async () => {
    try {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new Error('Invalid symbols: must be a non-empty array');
      }

      const raw = await fetchWithRetry(`/api/stocks-free?symbols=${symbols.join(',')}`);
      const stockMap = parseStockData(raw);
      if (!stockMap) throw new Error('No valid stock data received from any API');

      setStocks(prev => ({ ...FALLBACK_DATA, ...prev, ...stockMap }));
      setError(null);
      const now = Date.now();
      lastLiveSuccessRef.current = now;
      setReliability({
        status: 'live',
        source: 'live',
        lastSuccessAt: now,
        lastAttemptAt: now,
      });
      retryCountRef.current = 0;
    } catch (err) {
      setError(err.message);
      console.error('Stock fetch error (all APIs failed):', err);
      retryCountRef.current += 1;
      const now = Date.now();
      const age = lastLiveSuccessRef.current ? (now - lastLiveSuccessRef.current) : Number.POSITIVE_INFINITY;
      setReliability(prev => ({
        status: age > STALE_AFTER_MS ? 'stale' : 'fallback',
        source: prev.source === 'live' ? 'cache' : prev.source,
        lastSuccessAt: prev.lastSuccessAt,
        lastAttemptAt: now,
      }));
      setStocks(prev => (Object.keys(prev || {}).length > 0 ? prev : FALLBACK_DATA));
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  // Seed from Blob cache first (instant load), then fetch live data
  useEffect(() => {
    const seedFromCache = async () => {
      if (process.env.NODE_ENV === 'test') return;
      try {
        const res = await fetch('/api/latest');
        if (!res.ok) return;
        const { cached, data } = await res.json();
        if (cached && data?.stocks?.length > 0 && !seededFromCache.current) {
          seededFromCache.current = true;
          const stockMap = parseStockData(data.stocks);
          if (stockMap) {
            const cachedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now();
            const cacheAge = Date.now() - cachedAt;
            setStocks(prev => ({ ...FALLBACK_DATA, ...prev, ...stockMap }));
            setReliability({
              status: cacheAge > STALE_AFTER_MS ? 'stale' : 'fallback',
              source: 'cache',
              lastSuccessAt: cachedAt,
              lastAttemptAt: Date.now(),
            });
            setLoading(false);
          }
        }
      } catch {
        // Cache miss is fine — live fetch follows immediately
      }
    };

    seedFromCache();
    fetchStocks();
    const interval = setInterval(fetchStocks, 30000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  return {
    stocks,
    loading,
    error,
    reliability,
    refetch: fetchStocks,
    retryCount: retryCountRef.current
  };
}

export function useStockHistory(symbol, range = '1y') {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWithRetry(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`);

        if (!data || !Array.isArray(data.history)) {
          throw new Error('Invalid history data format');
        }

        setHistory(data.history);
      } catch (err) {
        console.error('History fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol, range]);

  return { history, loading, error };
}
