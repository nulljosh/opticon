// Flights proxy — OpenSky Network (free, no auth) + AviationStack (100 req/mo)
// Returns live flight states within a bounding box
// Cache: 15s in-memory (matches OpenSky rate limits)

const OPENSKY_BASE = 'https://opensky-network.org/api';
const AVIATIONSTACK_BASE = 'http://api.aviationstack.com/v1';

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

async function fetchAviationStack(bbox) {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) throw new Error('AVIATIONSTACK_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // AviationStack free tier doesn't support bbox — returns global live flights
    const res = await fetch(`${AVIATIONSTACK_BASE}/flights?access_key=${key}&flight_status=active&limit=100`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`AviationStack ${res.status}`);
    const json = await res.json();

    const states = (json.data ?? [])
      .filter(f => f.live?.latitude != null && f.live?.longitude != null)
      .filter(f => {
        const { latitude: lat, longitude: lon } = f.live;
        return lat >= bbox.lamin && lat <= bbox.lamax && lon >= bbox.lomin && lon <= bbox.lomax;
      })
      .map(f => ({
        icao24:   f.flight?.icao ?? '',
        callsign: f.flight?.iata ?? f.flight?.icao ?? '',
        origin:   f.departure?.iata ?? '',
        lastSeen: null,
        lon:      f.live.longitude,
        lat:      f.live.latitude,
        altitude: f.live.altitude ? Math.round(f.live.altitude * 3.28084) : null,
        onGround: f.live.is_ground,
        velocity: f.live.speed_horizontal ? Math.round(f.live.speed_horizontal * 0.539957) : null,
        heading:  f.live.direction ? Math.round(f.live.direction) : null,
        vertRate: null,
        dest:     f.arrival?.iata ?? '',
      }));

    return { source: 'aviationstack', states, count: states.length };
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
    console.warn('OpenSky failed, trying AviationStack:', openSkyErr.message);
    try {
      result = await fetchAviationStack(bbox);
    } catch (avErr) {
      console.error('Both flight APIs failed:', avErr.message);
      return res.status(502).json({ error: 'Flight data unavailable', states: [], count: 0 });
    }
  }

  cache = { data: result, ts: now };
  res.setHeader('Cache-Control', 'public, max-age=15');
  res.setHeader('X-Cache', 'MISS');
  return res.status(200).json(result);
}
