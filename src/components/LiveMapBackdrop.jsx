import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 40.7128, lon: -74.0060 };

export default function LiveMapBackdrop({ dark }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [centerReady, setCenterReady] = useState(false);
  const [payload, setPayload] = useState({ incidents: [], earthquakes: [], events: [] });

  useEffect(() => {
    if (!navigator.geolocation) {
      setCenterReady(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setCenterReady(true);
      },
      async () => {
        try {
          const res = await fetch('http://ip-api.com/json/?fields=lat,lon,status');
          const json = await res.json();
          if (json.status === 'success') setCenter({ lat: json.lat, lon: json.lon });
        } catch {
          // fallback stays on default center
        } finally {
          setCenterReady(true);
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
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
          zoom: 6.2,
          interactive: true,
          attributionControl: false,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
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
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({ center: [center.lon, center.lat], zoom: 6, duration: 1200 });
  }, [center.lat, center.lon]);

  useEffect(() => {
    let cancelled = false;
    const fetchSituation = async () => {
      try {
        const [inc, eq, ev] = await Promise.all([
          fetch(`/api/incidents?lat=${center.lat}&lon=${center.lon}`).then(r => r.json()).catch(() => ({ incidents: [] })),
          fetch('/api/earthquakes').then(r => r.json()).catch(() => ({ earthquakes: [] })),
          fetch('/api/events').then(r => r.json()).catch(() => ({ events: [] })),
        ]);
        if (!cancelled) {
          setPayload({
            incidents: inc.incidents || [],
            earthquakes: eq.earthquakes || [],
            events: ev.events || [],
          });
        }
      } catch {
        if (!cancelled) setPayload({ incidents: [], earthquakes: [], events: [] });
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

        const makePulse = (css, title) => {
          const el = document.createElement('div');
          el.style.cssText = css;
          if (title) el.title = title;
          return el;
        };

        // User pin
        markersRef.current.push(
          new maplibregl.Marker({
            element: makePulse(
              'width:14px;height:14px;border-radius:50%;background:#3B82F6;border:2px solid rgba(255,255,255,0.7);box-shadow:0 0 0 0 rgba(59,130,246,0.6);animation:pulse-blue 2s infinite;'
            ),
          })
            .setLngLat([center.lon, center.lat])
            .addTo(mapInstanceRef.current)
        );

        payload.incidents.slice(0, 25).forEach((inc) => {
          if (inc.lon == null || inc.lat == null) return;
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                'width:9px;height:9px;border-radius:50%;background:#F59E0B;box-shadow:0 0 0 0 rgba(245,158,11,0.55);animation:pulse-amber 1.8s infinite;',
                inc.description || inc.type
              ),
            })
              .setLngLat([inc.lon, inc.lat])
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
                `M${eq.mag} ${eq.place || ''}`
              ),
            })
              .setLngLat([eq.lon, eq.lat])
              .addTo(mapInstanceRef.current)
          );
        });

        // Global event pulses (visualized near center for ambient awareness).
        payload.events.slice(0, 3).forEach((ev, i) => {
          const offsetLon = center.lon + (i - 1) * 0.22;
          const offsetLat = center.lat + (i % 2 ? 0.18 : -0.18);
          markersRef.current.push(
            new maplibregl.Marker({
              element: makePulse(
                'width:8px;height:8px;border-radius:50%;background:#22D3EE;box-shadow:0 0 0 0 rgba(34,211,238,0.5);animation:pulse-cyan 2.2s infinite;',
                ev.title
              ),
            })
              .setLngLat([offsetLon, offsetLat])
              .addTo(mapInstanceRef.current)
          );
        });
      } catch {
        // ignore map marker failures
      }
    })();
  }, [center.lat, center.lon, payload]);

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
          filter: dark ? 'saturate(1.08) brightness(0.78)' : 'saturate(1.1) brightness(0.92)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: dark
            ? 'radial-gradient(circle at 50% 15%, rgba(2,6,23,0.08), rgba(2,6,23,0.42) 58%, rgba(2,6,23,0.56) 100%)'
            : 'radial-gradient(circle at 50% 15%, rgba(255,255,255,0.08), rgba(255,255,255,0.35) 58%, rgba(244,247,252,0.52) 100%)',
        }}
      />
    </>
  );
}
