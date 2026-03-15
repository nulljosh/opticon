// GDELT Project — global news events, geocoded, real-time 15min updates (free, no auth)
const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const CACHE_TTL = 5 * 60 * 1000;
let cache = null;

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  // Use location-specific cache key
  const cacheKey = (!isNaN(lat) && !isNaN(lon)) ? `${lat.toFixed(1)},${lon.toFixed(1)}` : 'global';

  if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      ...cache.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cache.ts }),
    });
  }

  // Make GDELT query location-aware when coordinates provided
  let query;
  if (!isNaN(lat) && !isNaN(lon)) {
    query = encodeURIComponent(`sourcelat:${lat.toFixed(1)} sourcelong:${lon.toFixed(1)} news OR politics OR economy OR technology OR health OR environment OR conflict OR disaster`);
  } else {
    query = encodeURIComponent('world OR breaking OR politics OR economy OR technology OR conflict OR disaster');
  }
  const url = `${GDELT_BASE}?query=${query}&mode=artlist&maxrecords=50&format=json&sort=datedesc`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`GDELT ${r.status}`);
    const json = await r.json();
    const events = (json.articles || []).slice(0, 25).map(a => ({
      title: a.title,
      url: a.url,
      domain: a.domain,
      date: a.seendate,
      country: a.sourcecountry,
    }));
    const data = {
      events,
      meta: buildMeta('live'),
    };
    cache = { ts: Date.now(), data, key: cacheKey };
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timer);
    console.error('GDELT error:', err.message);
    if (cache && cache.key === cacheKey) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        ...cache.data,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - cache.ts,
          warning: 'GDELT unavailable; serving stale cached events',
        }),
      });
    }
    return res.status(502).json({
      error: 'GDELT unavailable',
      events: [],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'GDELT unavailable and no cached events are available',
      }),
    });
  }
}
