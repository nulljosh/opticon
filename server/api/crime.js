// Crime data endpoint: aggregates open crime data feeds
// Returns normalized GeoJSON-compatible crime incidents

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const TIMEOUT_MS = 8000;
let cache = { data: null, ts: 0 };

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// CrimeMapping.com-style open data (many US cities publish via Socrata/CKAN)
// Using a generic approach: try city open data portals
async function fetchCrimeData(lat, lon) {
  const incidents = [];

  // Try SF OpenData as example (one of the most reliable)
  try {
    const sfData = await fetchWithTimeout(
      `https://data.sfgov.org/resource/wg3w-h783.json?$where=within_circle(point, ${lat}, ${lon}, 10000)&$limit=50&$order=incident_datetime DESC`
    );
    if (Array.isArray(sfData)) {
      sfData.forEach(item => {
        if (item.latitude && item.longitude) {
          incidents.push({
            lat: parseFloat(item.latitude),
            lng: parseFloat(item.longitude),
            type: 'crime',
            category: item.incident_category || 'Unknown',
            title: item.incident_description || item.incident_category || 'Crime incident',
            severity: categorySeverity(item.incident_category),
            timestamp: item.incident_datetime || new Date().toISOString(),
            source: 'sf_opendata',
          });
        }
      });
    }
  } catch {
    // SF data unavailable, try fallback
  }

  // Try Chicago CLEAR data
  try {
    const chiData = await fetchWithTimeout(
      `https://data.cityofchicago.org/resource/ijzp-q8t2.json?$where=within_circle(location, ${lat}, ${lon}, 10000)&$limit=50&$order=date DESC`
    );
    if (Array.isArray(chiData)) {
      chiData.forEach(item => {
        if (item.latitude && item.longitude) {
          incidents.push({
            lat: parseFloat(item.latitude),
            lng: parseFloat(item.longitude),
            type: 'crime',
            category: item.primary_type || 'Unknown',
            title: item.description || item.primary_type || 'Crime incident',
            severity: categorySeverity(item.primary_type),
            timestamp: item.date || new Date().toISOString(),
            source: 'chicago_clear',
          });
        }
      });
    }
  } catch {
    // Chicago data unavailable
  }

  // Try LA OpenData
  try {
    const laData = await fetchWithTimeout(
      `https://data.lacity.org/resource/2nrs-mtv8.json?$limit=50&$order=date_occ DESC`
    );
    if (Array.isArray(laData)) {
      laData.forEach(item => {
        if (item.lat && item.lon) {
          const itemLat = parseFloat(item.lat);
          const itemLon = parseFloat(item.lon);
          // Filter by distance (rough bounding box)
          if (Math.abs(itemLat - lat) < 0.1 && Math.abs(itemLon - lon) < 0.1) {
            incidents.push({
              lat: itemLat,
              lng: itemLon,
              type: 'crime',
              category: item.crm_cd_desc || 'Unknown',
              title: item.crm_cd_desc || 'Crime incident',
              severity: categorySeverity(item.crm_cd_desc),
              timestamp: item.date_occ || new Date().toISOString(),
              source: 'la_opendata',
            });
          }
        }
      });
    }
  } catch {
    // LA data unavailable
  }

  return incidents;
}

function categorySeverity(category) {
  if (!category) return 'low';
  const cat = category.toLowerCase();
  if (cat.includes('homicide') || cat.includes('murder') || cat.includes('assault') || cat.includes('robbery')) return 'high';
  if (cat.includes('burglary') || cat.includes('theft') || cat.includes('weapon') || cat.includes('narcotics')) return 'medium';
  return 'low';
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params required' });
  }

  // Check cache
  if (cache.data && (Date.now() - cache.ts) < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ incidents: cache.data, cached: true });
  }

  try {
    const incidents = await fetchCrimeData(lat, lon);
    cache = { data: incidents, ts: Date.now() };
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ incidents });
  } catch (err) {
    console.error('Crime API error:', err);
    if (cache.data) {
      return res.status(200).json({ incidents: cache.data, stale: true });
    }
    return res.status(500).json({ error: 'Failed to fetch crime data', details: err.message });
  }
}
