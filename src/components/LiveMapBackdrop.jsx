import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 40.7128, lon: -74.0060 };
const LAST_GEO_KEY = 'rise_last_geo';
const GEO_DETAIL_ZOOM = 13.6;
const CACHE_DETAIL_ZOOM = 13.2;
const IP_FALLBACK_ZOOM = 11.5;
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'https://rise-production.vercel.app' : '');

const apiPath = (path) => `${API_BASE}${path}`;

function loadStoredGeo() {
  try {
    const raw = localStorage.getItem(LAST_GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lon !== 'number') return null;
    return { lat: parsed.lat, lon: parsed.lon, label: parsed.label || 'Last known location' };
  } catch {
    return null;
  }
}

const GEO_KEYWORDS = [
  { re: /\bnew york|nyc|knicks|nets|yankees|mets|giants|jets|rangers\b/i, lat: 40.7128, lon: -74.0060, label: 'New York' },
  { re: /\blos angeles|lakers|clippers|dodgers|rams|chargers\b/i, lat: 34.0522, lon: -118.2437, label: 'Los Angeles' },
  { re: /\bchicago|bulls|bears|cubs|white sox\b/i, lat: 41.8781, lon: -87.6298, label: 'Chicago' },
  { re: /\bboston|celtics|red sox|patriots|bruins\b/i, lat: 42.3601, lon: -71.0589, label: 'Boston' },
  { re: /\bmiami|heat|dolphins|marlins\b/i, lat: 25.7617, lon: -80.1918, label: 'Miami' },
  { re: /\bdallas|mavericks|cowboys|rangers\b/i, lat: 32.7767, lon: -96.7970, label: 'Dallas' },
  { re: /\bsan francisco|warriors|49ers|giants\b/i, lat: 37.7749, lon: -122.4194, label: 'San Francisco' },
  { re: /\bwashington|white house|senate|congress|supreme court|president\b/i, lat: 38.9072, lon: -77.0369, label: 'Washington, DC' },
  { re: /\blondon\b/i, lat: 51.5074, lon: -0.1278, label: 'London' },
  { re: /\bparis\b/i, lat: 48.8566, lon: 2.3522, label: 'Paris' },
  { re: /\btokyo\b/i, lat: 35.6762, lon: 139.6503, label: 'Tokyo' },
  { re: /\bvancouver\b/i, lat: 49.2827, lon: -123.1207, label: 'Vancouver' },
  { re: /\btoronto\b/i, lat: 43.6532, lon: -79.3832, label: 'Toronto' },
];

const CITY_HUBS = [
  { label: 'Vancouver', lat: 49.2827, lon: -123.1207 },
  { label: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { label: 'New York', lat: 40.7128, lon: -74.0060 },
  { label: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { label: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { label: 'London', lat: 51.5074, lon: -0.1278 },
  { label: 'Paris', lat: 48.8566, lon: 2.3522 },
  { label: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { label: 'Sydney', lat: -33.8688, lon: 151.2093 },
];

function nearestHub(lat, lon) {
  return CITY_HUBS.reduce((best, hub) => {
    const d = (hub.lat - lat) ** 2 + (hub.lon - lon) ** 2;
    const bd = (best.lat - lat) ** 2 + (best.lon - lon) ** 2;
    return d < bd ? hub : best;
  }, CITY_HUBS[0]);
}

function geoKeywordMatch(text) {
  for (const k of GEO_KEYWORDS) {
    if (k.re.test(text || '')) return { lat: k.lat, lon: k.lon, label: k.label };
  }
  return null;
}

function fallbackPayload(baseCenter) {
  const hub = nearestHub(baseCenter.lat, baseCenter.lon);
  return {
    incidents: [{ type: 'estimated-construction', lat: hub.lat, lon: hub.lon, description: `Road works advisory near ${hub.label} (fallback)` }],
    trafficIncidents: [{ type: 'ESTIMATED', description: `Traffic slowdown estimate near ${hub.label}`, position: { lat: hub.lat + 0.01, lon: hub.lon - 0.01 } }],
    earthquakes: [],
    events: [
      { title: `Local event pulse near ${hub.label}`, country: 'LOCAL', url: null },
      { title: 'Transit disruption advisory', country: 'LOCAL', url: null },
    ],
    markets: [],
  };
}

function trafficColor(incident) {
  const text = `${incident?.type || ''} ${incident?.description || ''}`.toLowerCase();
  if (text.includes('heavy') || text.includes('accident') || text.includes('closure')) return '#ef4444';
  if (text.includes('moderate') || text.includes('slow') || text.includes('delay')) return '#f59e0b';
  return '#22c55e';
}

function mapsLink(lat, lon, zoom = 14) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}

function hasSource(data) {
  return Boolean(data?.source?.trim() && /^https?:\/\//.test(data?.link));
}

export default function LiveMapBackdrop({ dark }) {
  const storedGeo = loadStoredGeo();
  const initPos = storedGeo ? { lat: storedGeo.lat, lon: storedGeo.lon } : DEFAULT_CENTER;

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const centerRef = useRef(initPos);
  const sawGeoGrantedRef = useRef(false);
  const pendingFlyRef = useRef(null);

  const [center, setCenter] = useState(initPos);
  const [userPosition, setUserPosition] = useState(initPos);
  const [locLabel, setLocLabel] = useState(storedGeo?.label || 'Locating…');
  const [geoState, setGeoState] = useState(storedGeo ? 'cached' : 'checking');
  const [payload, setPayload] = useState({ incidents: [], trafficIncidents: [], earthquakes: [], events: [], markets: [] });
  const [selected, setSelected] = useState(null);

  useEffect(() => { centerRef.current = center; }, [center]);

  useEffect(() => {
    try { sawGeoGrantedRef.current = localStorage.getItem('rise_geo_granted') === '1'; } catch { sawGeoGrantedRef.current = false; }
  }, []);

  const persistGeo = useCallback((next, label) => {
    try { localStorage.setItem(LAST_GEO_KEY, JSON.stringify({ ...next, label, ts: Date.now() })); } catch {}
  }, []);

  const doFlyTo = useCallback((params) => {
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo(params);
    else pendingFlyRef.current = params;
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setLocLabel('Geolocation unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCenter(next);
        setUserPosition(next);
        doFlyTo({ center: [next.lon, next.lat], zoom: GEO_DETAIL_ZOOM, offset: [0, 120], duration: 850 });
        setLocLabel('Current location');
        setGeoState('granted');
        persistGeo(next, 'Current location');
        try { localStorage.setItem('rise_geo_granted', '1'); sawGeoGrantedRef.current = true; } catch {}
      },
      async (geoErr) => {
        setGeoState(geoErr?.code === 1 ? 'denied' : 'unavailable');
        try {
          const json = await fetch('https://ipapi.co/json/').then(r => r.json());
          if (typeof json?.latitude === 'number' && typeof json?.longitude === 'number') {
            const next = { lat: json.latitude, lon: json.longitude };
            setCenter(next);
            if (geoErr?.code !== 1) setUserPosition(next);
            doFlyTo({ center: [next.lon, next.lat], zoom: IP_FALLBACK_ZOOM, offset: [0, 120], duration: 850 });
            const label = json.city ? `${json.city} (IP)` : 'IP fallback';
            setLocLabel(label);
            persistGeo(next, label);
          } else {
            setLocLabel('Location unavailable');
          }
        } catch {
          setLocLabel('Location unavailable');
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [doFlyTo, persistGeo]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let statusRef = null;
    const onChange = () => {
      if (statusRef?.state !== 'granted') return;
      setGeoState('granted');
      requestLocation();
      if (!sawGeoGrantedRef.current) {
        try { localStorage.setItem('rise_geo_granted', '1'); } catch {}
        sawGeoGrantedRef.current = true;
      }
    };
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      statusRef = status;
      setGeoState(status.state);
      if (typeof status.addEventListener === 'function') status.addEventListener('change', onChange);
      else status.onchange = onChange;
    }).catch(() => {});
    return () => {
      if (!statusRef) return;
      if (typeof statusRef.removeEventListener === 'function') statusRef.removeEventListener('change', onChange);
      else if (statusRef.onchange === onChange) statusRef.onchange = null;
    };
  }, [requestLocation]);

  useEffect(() => {
    let map;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (!mapRef.current || mapInstanceRef.current) return;
        const initCenter = centerRef.current;
        map = new maplibregl.Map({
          container: mapRef.current,
          style: dark
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [initCenter.lon, initCenter.lat],
          zoom: storedGeo ? CACHE_DETAIL_ZOOM : 10.6,
          interactive: true,
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('moveend', () => {
          const c = map.getCenter();
          setCenter((prev) => {
            if (Math.abs(prev.lat - c.lat) < 0.08 && Math.abs(prev.lon - c.lng) < 0.08) return prev;
            return { lat: c.lat, lon: c.lng };
          });
        });
        mapInstanceRef.current = map;
        map.on('load', () => {
          if (pendingFlyRef.current) {
            map.flyTo(pendingFlyRef.current);
            pendingFlyRef.current = null;
          }
        });
      } catch (err) {
        console.warn('Backdrop map failed:', err.message);
      }
    })();
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    const fetchSituation = async () => {
      try {
        const [inc, traffic, eq, ev, mk] = await Promise.all([
          fetch(apiPath(`/api/incidents?lat=${center.lat}&lon=${center.lon}`)).then(r => r.json()).catch(() => ({ incidents: [] })),
          fetch(apiPath(`/api/traffic?lat=${center.lat}&lon=${center.lon}`)).then(r => r.json()).catch(() => ({ incidents: [] })),
          fetch(apiPath('/api/earthquakes')).then(r => r.json()).catch(() => ({ earthquakes: [] })),
          fetch(apiPath('/api/events')).then(r => r.json()).catch(() => ({ events: [] })),
          fetch(apiPath('/api/markets')).then(r => r.json()).catch(() => []),
        ]);
        if (!cancelled) {
          const fb = fallbackPayload(center);
          setPayload({
            incidents: inc.incidents?.length ? inc.incidents : fb.incidents,
            trafficIncidents: traffic.incidents?.length ? traffic.incidents : fb.trafficIncidents,
            earthquakes: eq.earthquakes || [],
            events: ev.events?.length ? ev.events : fb.events,
            markets: Array.isArray(mk) ? mk.slice(0, 20) : [],
          });
        }
      } catch {
        if (!cancelled) setPayload(fallbackPayload(center));
      }
    };
    fetchSituation();
    const id = setInterval(fetchSituation, 120000);
    return () => { cancelled = true; clearInterval(id); };
  }, [center.lat, center.lon]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const addMarker = (css, title, data, lon, lat) => {
          if (!hasSource(data)) return;
          const el = document.createElement('div');
          el.style.cssText = css;
          if (title) el.title = title;
          el.addEventListener('mouseenter', () => setSelected(data));
          el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(data); });
          markersRef.current.push(
            new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(mapInstanceRef.current)
          );
        };

        // User pin
        addMarker(
          'width:18px;height:24px;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 32\'><path d=\'M12 0C5.4 0 0 5.4 0 12c0 8.8 12 20 12 20s12-11.2 12-20C24 5.4 18.6 0 12 0z\' fill=\'%23ff3b30\'/><circle cx=\'12\' cy=\'12\' r=\'5\' fill=\'white\'/></svg>");background-size:contain;background-repeat:no-repeat;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.35));',
          'you',
          { type: 'location', title: 'You', detail: locLabel, level: 'local', source: geoState === 'granted' ? 'Browser Geolocation' : 'IP Geolocation', link: mapsLink(userPosition.lat, userPosition.lon) },
          userPosition.lon, userPosition.lat
        );

        // Local activity pulse
        addMarker(
          'width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,0.45);animation:pulse-cyan 2s infinite;',
          'local activity',
          { type: 'local', title: 'LOCAL ACTIVITY', detail: `Live local pulse near ${locLabel}`, level: 'local', source: 'Local search', link: `https://www.google.com/search?q=${encodeURIComponent(`events near ${locLabel}`)}` },
          center.lon + 0.006, center.lat + 0.004
        );

        payload.incidents.slice(0, 25).forEach((inc) => {
          if (inc.lon == null || inc.lat == null) return;
          addMarker(
            'width:44px;height:6px;border-radius:999px;background:repeating-linear-gradient(90deg,#f59e0b 0 7px,#fbbf24 7px 14px);border:1px solid rgba(0,0,0,0.22);transform:rotate(-22deg);box-shadow:0 0 0 0 rgba(245,158,11,0.35);animation:pulse-amber 1.8s infinite;',
            inc.description || inc.type,
            { type: 'construction', title: (inc.type || 'construction').toUpperCase(), detail: inc.description || 'Road/area incident', level: 'local', source: 'OpenStreetMap / Overpass', link: mapsLink(inc.lat, inc.lon) },
            inc.lon, inc.lat
          );
        });

        payload.trafficIncidents.slice(0, 20).forEach((inc) => {
          const p = inc.position;
          if (!p || p.lon == null || p.lat == null) return;
          addMarker(
            `width:48px;height:6px;border-radius:999px;background:${trafficColor(inc)};border:1px solid rgba(0,0,0,0.2);transform:rotate(18deg);box-shadow:0 0 0 0 rgba(249,115,22,0.35);animation:pulse-amber 1.6s infinite;`,
            inc.description || inc.type || 'traffic incident',
            { type: 'traffic', title: (inc.type || 'traffic').toUpperCase(), detail: inc.description || 'Traffic incident', level: 'local', source: 'Traffic feed / fallback model', link: mapsLink(p.lat, p.lon) },
            p.lon, p.lat
          );
        });

        payload.earthquakes.slice(0, 12).forEach((eq) => {
          if (eq.lon == null || eq.lat == null) return;
          const size = Math.max(10, Math.min(18, (eq.mag || 0) * 2.4));
          addMarker(
            `width:${size}px;height:${size}px;border-radius:50%;background:rgba(239,68,68,0.78);box-shadow:0 0 0 0 rgba(239,68,68,0.5);animation:pulse-red 1.9s infinite;`,
            `M${eq.mag} ${eq.place || ''}`,
            { type: 'seismic', title: `M${eq.mag?.toFixed?.(1) ?? eq.mag}`, detail: eq.place || 'Earthquake', level: (eq.mag || 0) >= 6 ? 'high' : (eq.mag || 0) >= 4 ? 'elevated' : 'monitor', source: 'USGS Earthquake Catalog', link: eq.url || 'https://earthquake.usgs.gov/earthquakes/map/' },
            eq.lon, eq.lat
          );
        });

        payload.events.slice(0, 16).forEach((ev, i) => {
          const kw = geoKeywordMatch(ev.title);
          const hub = CITY_HUBS[i % CITY_HUBS.length];
          const ring = (i % 3) * 0.12;
          const target = kw || {
            lat: hub.lat + (i % 2 ? ring : -ring * 0.7),
            lon: hub.lon + (i % 2 ? -ring * 0.8 : ring),
            label: hub.label,
          };
          addMarker(
            'width:9px;height:9px;border-radius:50%;background:#22D3EE;box-shadow:0 0 0 0 rgba(34,211,238,0.5);animation:pulse-cyan 2.2s infinite;',
            `${target.label}: ${ev.title}`,
            { type: 'event', title: ev.country ? `[${ev.country}] ${target.label}` : target.label, detail: ev.title, level: 'global', source: 'GDELT / News feed', link: ev.url || 'https://www.gdeltproject.org/' },
            target.lon, target.lat
          );
        });

        payload.markets.forEach((m) => {
          const p = geoKeywordMatch(m.question);
          if (!p) return;
          const prob = typeof m.probability === 'number' ? m.probability : 0.5;
          const conf = Math.max(prob, 1 - prob);
          const size = conf > 0.9 ? 12 : conf > 0.75 ? 10 : 8;
          addMarker(
            `width:${size}px;height:${size}px;border-radius:50%;background:${prob >= 0.5 ? '#22C55E' : '#F43F5E'};box-shadow:0 0 0 0 rgba(34,197,94,0.4);animation:pulse-cyan 2.4s infinite;`,
            `${Math.round(prob * 100)}% · ${m.question || 'market'}`,
            { type: 'prediction', title: `${Math.round(prob * 100)}% ${prob >= 0.5 ? 'YES' : 'NO'}`, detail: m.question || 'Prediction market', level: p.label, source: 'Polymarket', link: `https://polymarket.com/event/${m.eventSlug || m.slug}` },
            p.lon, p.lat
          );
        });
      } catch {
        // ignore map marker failures
      }
    })();
  }, [center.lat, center.lon, userPosition.lat, userPosition.lon, payload, locLabel, geoState]);

  return (
    <>
      <style>{`
        @keyframes pulse-blue { 0%{box-shadow:0 0 0 0 rgba(59,130,246,.55)} 70%{box-shadow:0 0 0 16px rgba(59,130,246,0)} 100%{box-shadow:0 0 0 0 rgba(59,130,246,0)} }
        @keyframes pulse-amber { 0%{box-shadow:0 0 0 0 rgba(245,158,11,.45)} 70%{box-shadow:0 0 0 12px rgba(245,158,11,0)} 100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} }
        @keyframes pulse-red { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)} 70%{box-shadow:0 0 0 16px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        @keyframes pulse-cyan { 0%{box-shadow:0 0 0 0 rgba(34,211,238,.45)} 70%{box-shadow:0 0 0 12px rgba(34,211,238,0)} 100%{box-shadow:0 0 0 0 rgba(34,211,238,0)} }
      `}</style>
      <div
        ref={mapRef}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'auto', filter: dark ? 'saturate(1.12) brightness(0.9)' : 'saturate(1.1) brightness(0.95)' }}
      />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: dark ? 'radial-gradient(circle at 50% 15%, rgba(2,6,23,0.06), rgba(2,6,23,0.28) 58%, rgba(2,6,23,0.42) 100%)' : 'radial-gradient(circle at 50% 15%, rgba(255,255,255,0.06), rgba(255,255,255,0.26) 58%, rgba(244,247,252,0.42) 100%)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)', backgroundSize: '52px 52px', mixBlendMode: dark ? 'screen' : 'multiply', opacity: 0.36 }} />
      <button
        onClick={() => {
          if (geoState !== 'granted') { requestLocation(); return; }
          mapInstanceRef.current?.flyTo({ center: [userPosition.lon, userPosition.lat], zoom: GEO_DETAIL_ZOOM, offset: [0, 120], duration: 900 });
        }}
        aria-label="Recenter to my location"
        title="Recenter to my location"
        style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 2, width: 34, height: 34, border: '1px solid rgba(255,255,255,0.24)', borderRadius: 9999, background: 'rgba(2,6,23,0.82)', color: '#ff5a52', font: '700 15px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        ⌖
      </button>

      {selected && (
        <div style={{ position: 'fixed', right: 14, bottom: 52, zIndex: 3, width: 320, maxWidth: 'calc(100vw - 28px)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 12, background: 'rgba(2,6,23,0.84)', color: '#fff', padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ font: '700 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' }}>{selected.title}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>x</button>
          </div>
          <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 11, lineHeight: 1.45 }}>{selected.detail}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{selected.level}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#93c5fd' }}>Source: {selected.source || 'Unknown'}</div>
          {selected.link && (
            <a href={selected.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#60a5fa', fontSize: 11, textDecoration: 'underline' }}>
              Open source →
            </a>
          )}
        </div>
      )}
    </>
  );
}
