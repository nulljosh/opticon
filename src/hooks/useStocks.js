import { useState, useEffect, useCallback, useRef } from 'react';

// MAG7 + Popular stocks + CFDs (32 total)
// Note: Block Inc rebranded SQ → XYZ in Jan 2025
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'CRM', 'PLTR', 'HOOD', 'COST', 'JPM', 'WMT', 'TGT', 'PG', 'HIMS', 'COIN', 'XYZ', 'SHOP', 'RKLB', 'SOFI', 'T', 'IBM', 'DIS', 'IWM', 'GC=F', 'SI=F', 'CL=F'];

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

// Fallback static data for when API fails (last known prices - Feb 19, 2026)
// Note: Block Inc rebranded SQ → XYZ in Jan 2025
const FALLBACK_DATA = {
  AAPL: { symbol: 'AAPL', price: 260.58, changePercent: -1.43 },
  MSFT: { symbol: 'MSFT', price: 398.46, changePercent: -0.29 },
  GOOGL: { symbol: 'GOOGL', price: 302.85, changePercent: -0.16 },
  AMZN: { symbol: 'AMZN', price: 204.86, changePercent: 0.03 },
  NVDA: { symbol: 'NVDA', price: 187.90, changePercent: -0.04 },
  META: { symbol: 'META', price: 644.78, changePercent: 0.24 },
  TSLA: { symbol: 'TSLA', price: 411.71, changePercent: 0.12 },
  PLTR: { symbol: 'PLTR', price: 134.89, changePercent: -0.36 },
  HOOD: { symbol: 'HOOD', price: 75.65, changePercent: 0.59 },
  COST: { symbol: 'COST', price: 987.82, changePercent: -0.83 },
  JPM: { symbol: 'JPM', price: 308.05, changePercent: -0.24 },
  WMT: { symbol: 'WMT', price: 124.87, changePercent: -1.38 },
  TGT: { symbol: 'TGT', price: 115.66, changePercent: 0.00 },
  PG: { symbol: 'PG', price: 158.56, changePercent: 1.08 },
  HIMS: { symbol: 'HIMS', price: 15.82, changePercent: -0.13 },
  COIN: { symbol: 'COIN', price: 165.94, changePercent: 1.15 },
  XYZ: { symbol: 'XYZ', price: 52.89, changePercent: 0.00 },
  SHOP: { symbol: 'SHOP', price: 123.80, changePercent: 1.78 },
  RKLB: { symbol: 'RKLB', price: 76.58, changePercent: 2.90 },
  SOFI: { symbol: 'SOFI', price: 19.30, changePercent: -1.23 },
  T: { symbol: 'T', price: 27.88, changePercent: 0.00 },
  IBM: { symbol: 'IBM', price: 256.28, changePercent: -1.73 },
  DIS: { symbol: 'DIS', price: 106.00, changePercent: -1.03 },
  IWM: { symbol: 'IWM', price: 264.60, changePercent: 0.23 },
  CRM: { symbol: 'CRM', price: 185.29, changePercent: -1.33 },
  'GC=F': { symbol: 'GC=F', price: 5019.90, changePercent: 0.45 },
  'SI=F': { symbol: 'SI=F', price: 78.32, changePercent: 0.88 },
  'CL=F': { symbol: 'CL=F', price: 66.83, changePercent: 0.65 },
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

      // Use 100% free Yahoo Chart API (no auth needed!)
      const raw = await fetchWithRetry(`/api/stocks-free?symbols=${symbols.join(',')}`);


      const stockMap = parseStockData(raw);
      if (!stockMap) throw new Error('No valid stock data received from any API');

      setStocks(stockMap);
      setError(null);
      retryCountRef.current = 0;
    } catch (err) {
      setError(err.message);
      console.error('Stock fetch error (all APIs failed):', err);
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
    const interval = setInterval(fetchStocks, 30000);
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
