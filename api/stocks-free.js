// 100% FREE stock API using Yahoo Finance Chart API (no key needed)
// Fetches per-symbol with query1/query2 fallback and per-symbol timeout

const YAHOO_URLS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function fetchSymbol(symbol) {
  for (const base of YAHOO_URLS) {
    const url = `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal, headers: HEADERS });
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
      console.warn(`Fetch error for ${symbol} at ${base}: ${err.message}`);
    }
  }
  return null; // all attempts failed
}

export default async function handler(req, res) {
  const raw = req.query.symbols || 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA';
  const symbolList = raw.split(',').map(s => s.trim()).filter(Boolean);

  if (symbolList.length > 100) {
    return res.status(400).json({ error: 'Too many symbols (max 100)' });
  }

  try {
    const results = await Promise.all(symbolList.map(fetchSymbol));
    const stocks = results.filter(r => r !== null);

    if (stocks.length === 0) {
      return res.status(500).json({ error: 'No valid stock data received' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(stocks);
  } catch (err) {
    console.error('stocks-free handler error:', err);
    return res.status(500).json({ error: 'Failed to fetch stock data', details: err.message });
  }
}
