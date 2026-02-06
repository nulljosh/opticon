import { useState, useEffect, useCallback, useRef } from 'react';

// MAG7 + Popular stocks + CFDs (32 total)
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'CRM', 'PLTR', 'HOOD', 'COST', 'JPM', 'WMT', 'TGT', 'PG', 'HIMS', 'COIN', 'SQ', 'SHOP', 'RKLB', 'SOFI', 'T', 'IBM', 'DIS', 'IWM', 'GC=F', 'SI=F', 'CL=F'];

// Retry helper with exponential backoff
const fetchWithRetry = async (url, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

      // Don't retry on certain errors
      if (err.message.includes('400') || err.message.includes('Invalid')) {
        throw err;
      }

      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
};

// Fallback static data for when API fails (last known prices - Feb 6, 2026)
const FALLBACK_DATA = {
  AAPL: { symbol: 'AAPL', price: 279, changePercent: 0.42 },
  MSFT: { symbol: 'MSFT', price: 394, changePercent: -0.18 },
  GOOGL: { symbol: 'GOOGL', price: 328, changePercent: 0.33 },
  AMZN: { symbol: 'AMZN', price: 205, changePercent: -7.96 },
  NVDA: { symbol: 'NVDA', price: 177, changePercent: 1.24 },
  META: { symbol: 'META', price: 656, changePercent: -2.19 },
  TSLA: { symbol: 'TSLA', price: 397, changePercent: 2.15 },
  PLTR: { symbol: 'PLTR', price: 136, changePercent: 1.82 },
  HOOD: { symbol: 'HOOD', price: 78, changePercent: -7.41 },
  COST: { symbol: 'COST', price: 980, changePercent: 0.31 },
  JPM: { symbol: 'JPM', price: 268, changePercent: 0.12 },
  WMT: { symbol: 'WMT', price: 128, changePercent: -0.08 },
  TGT: { symbol: 'TGT', price: 137, changePercent: 0.65 },
  PG: { symbol: 'PG', price: 172, changePercent: 0.22 },
  HIMS: { symbol: 'HIMS', price: 27, changePercent: 3.45 },
  COIN: { symbol: 'COIN', price: 146, changePercent: -12.58 },
  SQ: { symbol: 'SQ', price: 83, changePercent: 0.57 },
  SHOP: { symbol: 'SHOP', price: 131, changePercent: 0.05 },
  RKLB: { symbol: 'RKLB', price: 71, changePercent: 4.22 },
  SOFI: { symbol: 'SOFI', price: 19, changePercent: -6.22 },
  T: { symbol: 'T', price: 27, changePercent: -0.33 },
  IBM: { symbol: 'IBM', price: 290, changePercent: 0.18 },
  DIS: { symbol: 'DIS', price: 107, changePercent: -0.42 },
  IWM: { symbol: 'IWM', price: 256, changePercent: 0.55 },
  CRM: { symbol: 'CRM', price: 325, changePercent: -0.45 },
  'GC=F': { symbol: 'GC=F', price: 2870, changePercent: 0.32 },
  'SI=F': { symbol: 'SI=F', price: 32, changePercent: 0.18 },
  'CL=F': { symbol: 'CL=F', price: 73, changePercent: -0.55 },
};

// Parse stock data from either Vercel serverless or Yahoo raw response format
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
  const retryCountRef = useRef(0);
  const seededFromCache = useRef(false);

  const fetchStocks = useCallback(async () => {
    try {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new Error('Invalid symbols: must be a non-empty array');
      }

      const raw = await fetchWithRetry(`/api/stocks?symbols=${symbols.join(',')}`);
      const stockMap = parseStockData(raw);
      if (!stockMap) throw new Error('No valid stock data received');

      setStocks(stockMap);
      setError(null);
      retryCountRef.current = 0;
    } catch (err) {
      setError(err.message);
      console.error('Stock fetch error:', err);
      retryCountRef.current += 1;

      if (Object.keys(stocks).length === 0) {
        console.warn('Using fallback stock data');
        setStocks(FALLBACK_DATA);
      }
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  // Seed from Blob cache first (instant load), then fetch live data
  useEffect(() => {
    const seedFromCache = async () => {
      try {
        const res = await fetch('/api/latest');
        if (!res.ok) return;
        const { cached, data } = await res.json();
        if (cached && data?.stocks?.length > 0 && !seededFromCache.current) {
          seededFromCache.current = true;
          const stockMap = parseStockData(data.stocks);
          if (stockMap) {
            setStocks(stockMap);
            setLoading(false);
          }
        }
      } catch {
        // Cache miss is fine
      }
    };

    seedFromCache();
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  return {
    stocks,
    loading,
    error,
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

        // Validate response
        if (!data || !Array.isArray(data.history)) {
          throw new Error('Invalid history data format');
        }

        setHistory(data.history);
      } catch (err) {
        console.error('History fetch error:', err);
        setError(err.message);
        // Keep old data on error
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol, range]);

  return { history, loading, error };
}
