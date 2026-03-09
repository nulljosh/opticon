import { applyCors } from './_cors.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const SERIES_MAP = {
  deficit: 'FYFSD',
  treasury2y: 'DGS2',
  treasury10y: 'DGS10',
  treasury30y: 'DGS30',
  cpi: 'CPIAUCSL',
  fedFunds: 'FEDFUNDS',
  gdp: 'A191RL1Q225SBEA',
};

let cache = {
  ts: 0,
  data: null,
};

function parseObservation(seriesId, observation) {
  const valueRaw = observation?.value;
  const parsed = Number(valueRaw);

  return {
    value: Number.isFinite(parsed) ? parsed : null,
    date: observation?.date ?? null,
    series: seriesId,
  };
}

async function fetchSeries(seriesId, apiKey) {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    sort_order: 'desc',
    limit: '1',
    file_type: 'json',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${FRED_BASE}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`FRED ${seriesId} returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const observation = payload?.observations?.[0];

    if (!observation) {
      return {
        value: null,
        date: null,
        series: seriesId,
      };
    }

    return parseObservation(seriesId, observation);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMacroData(apiKey) {
  const entries = Object.entries(SERIES_MAP);
  const settled = await Promise.allSettled(
    entries.map(([key, seriesId]) => fetchSeries(seriesId, apiKey).then(result => [key, result]))
  );

  const data = {};

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const [key, value] = result.value;
      data[key] = value;
      return;
    }

    const [key, seriesId] = entries[index];
    data[key] = { value: null, date: null, series: seriesId };
  });

  return {
    ...data,
    updatedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'FRED API key not configured' });
  }

  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL_MS) {
    return res.status(200).json(cache.data);
  }

  try {
    const fresh = await fetchMacroData(apiKey);
    cache = { ts: now, data: fresh };
    return res.status(200).json(fresh);
  } catch (error) {
    console.error('Macro API error:', error);

    if (cache.data) {
      return res.status(200).json(cache.data);
    }

    const status = error?.name === 'AbortError' ? 504 : 502;
    return res.status(status).json({
      error: 'Failed to fetch macroeconomic data',
      details: error?.message || 'Unknown error',
    });
  }
}
