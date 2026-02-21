import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 40.7128, lon: -74.0060 };
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'https://rise-production.vercel.app' : '');

function apiPath(path) {
  return `${API_BASE}${path}`;
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
  let best = CITY_HUBS[0];
  let bestDist = Infinity;
  for (const hub of CITY_HUBS) {
    const dLat = hub.lat - lat;
    const dLon = hub.lon - lon;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDist) {
      best = hub;
      bestDist = dist;
    }
  }
  return best;
}

function inferMarketPoint(question, i, center) {
  for (const k of GEO_KEYWORDS) {
    if (k.re.test(question || '')) return { lat: k.lat, lon: k.lon, label: k.label };
  }
  return null;
}

function trafficColor(incident) {
  const text = `${incident?.type || ''} ${incident?.description || ''}`.toLowerCase();
  if (text.includes('heavy') || text.includes('accident') || text.includes('closure')) return '#ef4444';
  if (text.includes('moderate') || text.includes('slow') || text.includes('delay')) return '#f59e0b';
  return '#22c55e';
}

export default function LiveMapBackdrop({ dark }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const sawGeoGrantedRef = useRef(false);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [userPosition, setUserPosition] = useState(DEFAULT_CENTER);
  const [centerReady] = useState(true);
  const [locLabel, setLocLabel] = useState('Locating…');
  const [geoState, setGeoState] = useState('checking');
  const [payload, setPayload] = useState({ incidents: [], trafficIncidents: [], earthquakes: [], events: [], markets: [] });
  const [selected, setSelected] = useState(null);

  const fallbackPayload = (baseCenter) => {
    const hub = nearestHub(baseCenter.lat, baseCenter.lon);
    return {
    incidents: [
      {
        type: 'estimated-construction',
        lat: hub.lat,
        lon: hub.lon,
        description: `Road works advisory near ${hub.label} (fallback)`,
      },
    ],
    trafficIncidents: [
      {
        type: 'ESTIMATED',
        description: `Traffic slowdown estimate near ${hub.label}`,
        position: { lat: hub.lat + 0.01, lon: hub.lon - 0.01 },
      },
    ],
    earthquakes: [],
    events: [
      { title: `Local event pulse near ${hub.label}`, country: 'LOCAL', url: null },
      { title: 'Transit disruption advisory', country: 'LOCAL', url: null },
    ],
    markets: [],
  };
  };

  useEffect(() => {
    try {
      sawGeoGrantedRef.current = localStorage.getItem('rise_geo_granted') === '1';
    } catch {
      sawGeoGrantedRef.current = false;
    }
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
        mapInstanceRef.current?.flyTo({ center: [next.lon, next.lat], zoom: 11.5, offset: [0, 120], duration: 850 });
        setLocLabel('Current location');
        setGeoState('granted');
        try {
          localStorage.setItem('rise_geo_granted', '1');
          sawGeoGrantedRef.current = true;
        } catch {
          // ignore storage failures
        }
      },
      async (geoErr) => {
        if (geoErr?.code === 1) setGeoState('denied');
        else setGeoState('unavailable');
        try {
          const res = await fetch('https://ipapi.co/json/');
          const json = await res.json();
          if (json && typeof json.latitude === 'number' && typeof json.longitude === 'number') {
            const next = { lat: json.latitude, lon: json.longitude };
            setCenter(next);
            setUserPosition(next);
            mapInstanceRef.current?.flyTo({ center: [next.lon, next.lat], zoom: 11.5, offset: [0, 120], duration: 850 });
            setLocLabel(json.city ? `${json.city} (IP)` : 'IP fallback');
          } else {
            setLocLabel('Location unavailable');
          }
        } catch {
          // fallback stays on default center
          setLocLabel('Location unavailable');
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let statusRef = null;
    const onChange = () => {
      if (statusRef?.state === 'granted') {
        setGeoState('granted');
        requestLocation();
        if (!sawGeoGrantedRef.current) {
          try { localStorage.setItem('rise_geo_granted', '1'); } catch {}
          sawGeoGrantedRef.current = true;
        }
      }
    };

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        statusRef = status;
        setGeoState(status.state);
        if (typeof status.addEventListener === 'function') {
          status.addEventListener('change', onChange);
        } else {
          status.onchange = onChange;
        }
      })
      .catch(() => {});

    return () => {
      if (!statusRef) return;
      if (typeof statusRef.removeEventListener === 'function') {
        statusRef.removeEventListener('change', onChange);
      } else if (statusRef.onchange === onChange) {
        statusRef.onchange = null;
      }
    };
  }, [requestLocation]);

  useEffect(() => {
    if (!centerReady) return;
    let map;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (!mapRef.current || mapInstanceRef.current) return;
        map = new maplibregl.Map({
          container: mapRef.current,
          style: dark
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [center.lon, center.lat],
          zoom: 10.6,
          interactive: true,
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        const onMoveEnd = () => {
          const c = map.getCenter();
          setCenter((prev) => {
            if (Math.abs(prev.lat - c.lat) < 0.08 && Math.abs(prev.lon - c.lng) < 0.08) return prev;
            return { lat: c.lat, lon: c.lng };
          });
        };
        map.on('moveend', onMoveEnd);
        mapInstanceRef.current = map;
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
  }, [dark, centerReady]);

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
          const merged = {
            incidents: inc.incidents || [],
            trafficIncidents: traffic.incidents || [],
            earthquakes: eq.earthquakes || [],
            events: ev.events || [],
            markets: Array.isArray(mk) ? mk.slice(0, 20) : [],
          };
          if (merged.incidents.length === 0) {
            merged.incidents = fallbackPayload(center).incidents;
          }
          if (merged.trafficIncidents.length === 0) {
            merged.trafficIncidents = fallbackPayload(center).trafficIncidents;
          }
          if (merged.events.length === 0) {
            merged.events = fallbackPayload(center).events;
          }
          setPayload(merged);
        }
      } catch {
        if (!cancelled) setPayload(fallbackPayload(center));
      }
    };
    fetchSituation();
    const id = setInterval(fetchSituation, 120000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [center.lat, center.lon]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const makePulse = (css, title, data) => {
          const el = document.createElement('div');
          el.style.cssText = css;
          if (title) el.title = title;
          if (data) {
            el.addEventListener('mouseenter', () => setSelected(data));
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              setSelected(data);
            });
          }
          return el;
        };

        // User pin + label
        markersRef.current.push(
          new maplibregl.Marker({
            element: makePulse(
              'width:18px;height:18px;border-radius:50%;background:#3B82F6;border:3px solid rgba(255,255,255,0.9);box-shadow:0 0 0 0 rgba(59,130,246,0.65);animation:pulse-blue 2s infinite;',
              'you',
              { type: 'location', title: 'You', detail: locLabel, level: 'local' }
            ),
          })
            .setLngLat([userPosition.lon, userPosition.lat])
            .addTo(mapInstanceRef.current)
        );
        markersRef.current.push(
          new maplibregl.Marker({
            element: makePulse(
              'background:rgba(15,23,42,0.82);color:#fff;font:700 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:2px 6px;border-radius:999px;border:1px solid rgba(255,255,255,0.25);',
              'you',
              { type: 'location', title: 'You', detail: locLabel, level: 'local' }
            ),
            offset: [0, -18],
          })
            .setLngLat([userPosition.lon, userPosition.lat])
            .addTo(mapInstanceRef.current)
        );

        payload.incidents.slice(0, 25).forEach((inc) => {
          if (inc.lon == null || inc.lat == null) return;
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                'width:30px;height:4px;border-radius:999px;background:repeating-linear-gradient(90deg,#f59e0b 0 6px,#fbbf24 6px 12px);transform:rotate(-22deg);box-shadow:0 0 0 0 rgba(245,158,11,0.35);animation:pulse-amber 1.8s infinite;',
                inc.description || inc.type,
                { type: 'construction', title: (inc.type || 'construction').toUpperCase(), detail: inc.description || 'Road/area incident', level: 'local' }
              ),
            })
              .setLngLat([inc.lon, inc.lat])
              .addTo(mapInstanceRef.current)
          );
        });

        payload.trafficIncidents.slice(0, 20).forEach((inc) => {
          const p = inc.position;
          if (!p || p.lon == null || p.lat == null) return;
          const lineColor = trafficColor(inc);
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                `width:34px;height:4px;border-radius:999px;background:${lineColor};transform:rotate(18deg);box-shadow:0 0 0 0 rgba(249,115,22,0.35);animation:pulse-amber 1.6s infinite;`,
                inc.description || inc.type || 'traffic incident',
                { type: 'traffic', title: (inc.type || 'traffic').toUpperCase(), detail: inc.description || 'Traffic incident', level: 'local' }
              ),
            })
              .setLngLat([p.lon, p.lat])
              .addTo(mapInstanceRef.current)
          );
        });

        payload.earthquakes.slice(0, 12).forEach((eq) => {
          if (eq.lon == null || eq.lat == null) return;
          const size = Math.max(10, Math.min(18, (eq.mag || 0) * 2.4));
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                `width:${size}px;height:${size}px;border-radius:50%;background:rgba(239,68,68,0.78);box-shadow:0 0 0 0 rgba(239,68,68,0.5);animation:pulse-red 1.9s infinite;`,
                `M${eq.mag} ${eq.place || ''}`,
                {
                  type: 'seismic',
                  title: `M${eq.mag?.toFixed?.(1) ?? eq.mag}`,
                  detail: eq.place || 'Earthquake',
                  level: (eq.mag || 0) >= 6 ? 'high' : (eq.mag || 0) >= 4 ? 'elevated' : 'monitor',
                }
              ),
            })
              .setLngLat([eq.lon, eq.lat])
              .addTo(mapInstanceRef.current)
          );
        });

        // Global event pulses (visualized near center for ambient awareness).
        payload.events.slice(0, 16).forEach((ev, i) => {
          let target = null;
          for (const k of GEO_KEYWORDS) {
            if (k.re.test(ev.title || '')) {
              target = { lat: k.lat, lon: k.lon, label: k.label };
              break;
            }
          }
          if (!target) {
            const hub = CITY_HUBS[i % CITY_HUBS.length];
            const ring = (i % 3) * 0.12;
            target = {
              lat: hub.lat + (i % 2 ? ring : -ring * 0.7),
              lon: hub.lon + (i % 2 ? -ring * 0.8 : ring),
              label: hub.label,
            };
          }
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                'width:9px;height:9px;border-radius:50%;background:#22D3EE;box-shadow:0 0 0 0 rgba(34,211,238,0.5);animation:pulse-cyan 2.2s infinite;',
                `${target.label}: ${ev.title}`,
                { type: 'event', title: ev.country ? `[${ev.country}] ${target.label}` : target.label, detail: ev.title, level: 'global', link: ev.url || null }
              ),
            })
              .setLngLat([target.lon, target.lat])
              .addTo(mapInstanceRef.current)
          );
        });

        payload.markets.forEach((m, i) => {
          const p = inferMarketPoint(m.question, i, center);
          if (!p) return; // Only show markets with a confident geographic anchor.
          const prob = typeof m.probability === 'number' ? m.probability : 0.5;
          const conf = Math.max(prob, 1 - prob);
          const size = conf > 0.9 ? 12 : conf > 0.75 ? 10 : 8;
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                `width:${size}px;height:${size}px;border-radius:50%;background:${prob >= 0.5 ? '#22C55E' : '#F43F5E'};box-shadow:0 0 0 0 rgba(34,197,94,0.4);animation:pulse-cyan 2.4s infinite;`,
                `${Math.round(prob * 100)}% · ${m.question || 'market'}`,
                {
                  type: 'prediction',
                  title: `${Math.round(prob * 100)}% ${prob >= 0.5 ? 'YES' : 'NO'}`,
                  detail: m.question || 'Prediction market',
                  level: p.label,
                  link: `https://polymarket.com/event/${m.eventSlug || m.slug}`,
                }
              ),
            })
              .setLngLat([p.lon, p.lat])
              .addTo(mapInstanceRef.current)
          );
        });
      } catch {
        // ignore map marker failures
      }
    })();
  }, [center.lat, center.lon, userPosition.lat, userPosition.lon, payload]);

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
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'auto',
          filter: dark ? 'saturate(1.12) brightness(0.9)' : 'saturate(1.1) brightness(0.95)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: dark
            ? 'radial-gradient(circle at 50% 15%, rgba(2,6,23,0.06), rgba(2,6,23,0.28) 58%, rgba(2,6,23,0.42) 100%)'
            : 'radial-gradient(circle at 50% 15%, rgba(255,255,255,0.06), rgba(255,255,255,0.26) 58%, rgba(244,247,252,0.42) 100%)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          mixBlendMode: dark ? 'screen' : 'multiply',
          opacity: 0.36,
        }}
      />
      <button
        onClick={() => {
          if (geoState !== 'granted') {
            requestLocation();
            return;
          }
          mapInstanceRef.current?.flyTo({ center: [userPosition.lon, userPosition.lat], zoom: 11.5, offset: [0, 120], duration: 900 });
        }}
        style={{
          position: 'fixed',
          right: 14,
          bottom: 14,
          zIndex: 2,
          border: '1px solid rgba(16,185,129,0.5)',
          borderRadius: 999,
          background: 'rgba(2,6,23,0.86)',
          color: '#86efac',
          font: '600 11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {geoState === 'granted' ? `YOU · ${locLabel}` : 'ENABLE LOCATION'}
      </button>

      {selected && (
        <div
          style={{
            position: 'fixed',
            right: 14,
            bottom: 52,
            zIndex: 3,
            width: 320,
            maxWidth: 'calc(100vw - 28px)',
            border: '1px solid rgba(255,255,255,0.24)',
            borderRadius: 12,
            background: 'rgba(2,6,23,0.84)',
            color: '#fff',
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ font: '700 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' }}>{selected.title}</div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            >
              x
            </button>
          </div>
          <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 11, lineHeight: 1.45 }}>{selected.detail}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{selected.level}</div>
          {selected.link && (
            <a
              href={selected.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 8, color: '#60a5fa', fontSize: 11, textDecoration: 'underline' }}
            >
              Open source link →
            </a>
          )}
        </div>
      )}
    </>
  );
}
