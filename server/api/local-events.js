// Local events endpoint: PredictHQ API for concerts, sports, community events
// Single source that aggregates Eventbrite, Meetup, sports, concerts

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const TIMEOUT_MS = 8000;
const cache = new Map();

async function fetchWithTimeout(url, headers = {}, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function severityFromCategory(category) {
  const high = ['disasters', 'terror', 'severe-weather'];
  const medium = ['sports', 'concerts', 'festivals', 'conferences'];
  if (high.includes(category)) return 'high';
  if (medium.includes(category)) return 'medium';
  return 'low';
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = req.query.radius || '10km';

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params required' });
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ events: cached.data, cached: true });
  }

  const apiKey = process.env.PREDICTHQ_API_KEY;

  // If no PredictHQ key, return empty (non-critical data source)
  if (!apiKey) {
    return res.status(200).json({ events: [], note: 'PREDICTHQ_API_KEY not configured' });
  }

  try {
    const now = new Date().toISOString().split('T')[0];
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const url = `https://api.predicthq.com/v1/events/?within=${radius}@${lat},${lon}&active.gte=${now}&active.lte=${weekLater}&limit=50&sort=rank`;

    const data = await fetchWithTimeout(url, {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    });

    const events = (data.results || [])
      .filter(e => e.location && e.location.length === 2)
      .map(e => ({
        lat: e.location[1],
        lng: e.location[0],
        type: 'local-event',
        category: e.category || 'event',
        title: e.title || 'Local event',
        severity: severityFromCategory(e.category),
        timestamp: e.start || new Date().toISOString(),
        attendees: e.phq_attendance || null,
        rank: e.rank || 0,
        source: 'predicthq',
      }));

    cache.set(cacheKey, { data: events, ts: Date.now() });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ events });
  } catch (err) {
    console.error('Local events API error:', err);
    if (cached) {
      return res.status(200).json({ events: cached.data, stale: true });
    }
    return res.status(200).json({ events: [] });
  }
}
