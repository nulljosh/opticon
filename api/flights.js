// Flights proxy — OpenSky Network (free, no auth)
// Returns live flight states within a bounding box
// Cache: 15s in-memory (matches OpenSky rate limits)

const OPENSKY_BASE = 'https://opensky-network.org/api';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 15_000; // 15 seconds

function parseBbox(query) {
  const { lamin, lomin, lamax, lomax } = query;
  const nums = [lamin, lomin, lamax, lomax].map(Number);
  if (nums.some(isNaN)) return null;
  const [la1, lo1, la2, lo2] = nums;
  if (la1 >= la2 || lo1 >= lo2) return null;
  return { lamin: la1, lomin: lo1, lamax: la2, lomax: lo2 };
}

async function fetchOpenSky(bbox) {
  const params = new URLSearchParams({
    lamin: bbox.lamin,
    lomin: bbox.lomin,
    lamax: bbox.lamax,
    lomax: bbox.lomax,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${OPENSKY_BASE}/states/all?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`OpenSky ${res.status}`);
    const json = await res.json();

    const states = (json.states ?? []).map(s => ({
      icao24:    s[0],
      callsign:  (s[1] ?? '').trim(),
      origin:    s[2],
      lastSeen:  s[4],
      lon:       s[5],
      lat:       s[6],
      altitude:  s[7] ? Math.round(s[7] * 3.28084) : null, // metres → feet
      onGround:  s[8],
      velocity:  s[9] ? Math.round(s[9] * 1.94384) : null, // m/s → knots
      heading:   s[10] ? Math.round(s[10]) : null,
      vertRate:  s[11],
    })).filter(f => f.lat !== null && f.lon !== null && !f.onGround);

    return { source: 'opensky', states, count: states.length };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bbox = parseBbox(req.query);
  if (!bbox) {
    return res.status(400).json({ error: 'Invalid bbox: provide lamin, lomin, lamax, lomax' });
  }

  // Serve from 15s in-memory cache when possible
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  let result;
  try {
    result = await fetchOpenSky(bbox);
  } catch (openSkyErr) {
    console.error('OpenSky failed:', openSkyErr.message);
    return res.status(502).json({ error: 'Flight data unavailable', states: [], count: 0 });
  }

  cache = { data: result, ts: now };
  res.setHeader('Cache-Control', 'public, max-age=15');
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(result);
}
