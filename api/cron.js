import { put } from '@vercel/blob';

const BLOB_FILENAME = 'bread-cache/results.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const timedFetch = (url, opts = {}, ms = 10000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
};

async function fetchMarkets() {
  try {
    const res = await timedFetch(
      'https://gamma-api.polymarket.com/markets?closed=false&limit=50&order=volume24hr&ascending=false',
      { headers: { Accept: 'application/json' } }, 15000
    );
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return Array.isArray(data) ? data.filter(m => m?.id && m?.question && m?.slug) : [];
  } catch (e) { console.error('Cron markets:', e.message); return []; }
}

async function fetchStocks() {
  const syms = 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA,CRM,PLTR,HOOD,COST,JPM,WMT,TGT,PG,HIMS,COIN,SQ,SHOP,RKLB,SOFI,T,IBM,DIS,IWM,GC=F,SI=F,CL=F';
  try {
    const res = await timedFetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${syms}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.quoteResponse?.result || [])
      .filter(q => q?.symbol && q?.regularMarketPrice !== undefined)
      .map(q => ({
        symbol: q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume: q.regularMarketVolume ?? 0,
      }));
  } catch (e) { console.error('Cron stocks:', e.message); return []; }
}

async function fetchCommodities() {
  const syms = { gold: 'GC=F', silver: 'SI=F', platinum: 'PL=F', palladium: 'PA=F', copper: 'HG=F', oil: 'CL=F', natgas: 'NG=F', nas100: '^NDX', us500: '^GSPC', us30: '^DJI', dxy: 'DX-Y.NYB' };
  const results = {};
  await Promise.all(Object.entries(syms).map(async ([key, sym]) => {
    try {
      const res = await timedFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`,
        { headers: { 'User-Agent': UA } }, 8000
      );
      if (!res.ok) return;
      const meta = (await res.json()).chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice && typeof meta.regularMarketPrice === 'number') {
        const prev = meta.chartPreviousClose || meta.previousClose;
        results[key] = {
          price: meta.regularMarketPrice,
          change: prev ? meta.regularMarketPrice - prev : 0,
          changePercent: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0,
        };
      }
    } catch (e) { console.error(`Cron ${key}:`, e.message); }
  }));
  return results;
}

async function fetchCrypto() {
  try {
    const res = await timedFetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(res.status);
    const d = await res.json();
    return {
      btc: { spot: d.bitcoin?.usd ?? null, chgPct: d.bitcoin?.usd_24h_change ?? 0 },
      eth: { spot: d.ethereum?.usd ?? null, chgPct: d.ethereum?.usd_24h_change ?? 0 },
    };
  } catch (e) { console.error('Cron crypto:', e.message); return null; }
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [markets, stocks, commodities, crypto] = await Promise.all([
      fetchMarkets(), fetchStocks(), fetchCommodities(), fetchCrypto(),
    ]);

    const results = { markets, stocks, commodities, crypto, updatedAt: new Date().toISOString() };

    const blob = await put(BLOB_FILENAME, JSON.stringify(results), {
      access: 'public',
      addRandomSuffix: false,
    });

    res.status(200).json({
      ok: true,
      counts: { markets: markets.length, stocks: stocks.length, commodities: Object.keys(commodities).length },
      blobUrl: blob.url,
      updatedAt: results.updatedAt,
    });
  } catch (err) {
    console.error('Cron failed:', err);
    res.status(500).json({ error: err.message });
  }
}
