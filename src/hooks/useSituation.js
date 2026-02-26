import { useState, useEffect, useCallback } from 'react';

export const WORLD_CITIES = [
  { id: 'nyc',    label: 'NYC',    lat: 40.7128,  lon: -74.0060,  name: 'New York' },
  { id: 'london', label: 'London', lat: 51.5074,  lon: -0.1278,   name: 'London'   },
  { id: 'tokyo',  label: 'Tokyo',  lat: 35.6762,  lon: 139.6503,  name: 'Tokyo'    },
  { id: 'paris',  label: 'Paris',  lat: 48.8566,  lon: 2.3522,    name: 'Paris'    },
  { id: 'dubai',  label: 'Dubai',  lat: 25.2048,  lon: 55.2708,   name: 'Dubai'    },
  { id: 'sydney', label: 'Sydney', lat: -33.8688, lon: 151.2093,  name: 'Sydney'   },
];

const FLIGHT_REFRESH    = 15_000;
const TRAFFIC_REFRESH   = 60_000;
const SITUATION_REFRESH = 5 * 60_000;
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'https://opticon-production.vercel.app' : '');

function apiPath(path) {
  return `${API_BASE}${path}`;
}

function bboxFromCenter(lat, lon, deg = 2) {
  return { lamin: lat - deg, lomin: lon - deg, lamax: lat + deg, lomax: lon + deg };
}

async function fetchWithTimeout(url, ms = 8000) {
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

export function useSituation() {
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const [flights, setFlights] = useState([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState(null);

  const [traffic, setTraffic] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState(null);

  const [incidents, setIncidents] = useState([]);
  const [earthquakes, setEarthquakes] = useState([]);
  const [events, setEvents] = useState([]);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [crimeIncidents, setCrimeIncidents] = useState([]);
  const [localEvents, setLocalEvents] = useState([]);

  const activeCenter = selectedCity
    ? { lat: selectedCity.lat, lon: selectedCity.lon, label: selectedCity.label }
    : userLocation
      ? { lat: userLocation.lat, lon: userLocation.lon, label: userLocation.city }
      : { lat: WORLD_CITIES[0].lat, lon: WORLD_CITIES[0].lon, label: WORLD_CITIES[0].label };

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    fetchWithTimeout('https://ipapi.co/json/')
      .then(data => {
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          setUserLocation({ lat: data.latitude, lon: data.longitude, city: data.city || 'IP fallback' });
        }
        else setLocationError('Geolocation unavailable');
      })
      .catch(err => setLocationError(err.message));
  }, []);

  const fetchFlights = useCallback(async () => {
    setFlightsLoading(true);
    setFlightsError(null);
    const bbox = bboxFromCenter(activeCenter.lat, activeCenter.lon);
    try {
      const data = await fetchWithTimeout(
        apiPath(`/api/flights?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`)
      );
      setFlights(data.states ?? []);
    } catch (err) {
      setFlightsError(err.message);
    } finally {
      setFlightsLoading(false);
    }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchTraffic = useCallback(async () => {
    setTrafficLoading(true);
    setTrafficError(null);
    try {
      const data = await fetchWithTimeout(apiPath(`/api/traffic?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setTraffic(data);
    } catch (err) {
      setTrafficError(err.message);
    } finally {
      setTrafficLoading(false);
    }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/incidents?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setIncidents(data.incidents ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchEarthquakes = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath('/api/earthquakes'));
      setEarthquakes(data.earthquakes ?? []);
    } catch { /* non-critical */ }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath('/api/events'));
      setEvents(data.events ?? []);
    } catch { /* non-critical */ }
  }, []);

  const fetchWeatherAlerts = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/weather-alerts?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setWeatherAlerts(data.alerts ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchCrime = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/crime?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setCrimeIncidents(data.incidents ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchLocalEvents = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/local-events?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setLocalEvents(data.events ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  useEffect(() => {
    fetchFlights();
    fetchTraffic();
    const fi = setInterval(fetchFlights, FLIGHT_REFRESH);
    const ti = setInterval(fetchTraffic, TRAFFIC_REFRESH);
    return () => { clearInterval(fi); clearInterval(ti); };
  }, [fetchFlights, fetchTraffic]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    fetchIncidents();
    fetchEarthquakes();
    fetchEvents();
    fetchWeatherAlerts();
    fetchCrime();
    fetchLocalEvents();
    const si = setInterval(() => {
      fetchIncidents();
      fetchEarthquakes();
      fetchEvents();
      fetchWeatherAlerts();
      fetchCrime();
      fetchLocalEvents();
    }, SITUATION_REFRESH);
    return () => clearInterval(si);
  }, [fetchIncidents, fetchEarthquakes, fetchEvents, fetchWeatherAlerts, fetchCrime, fetchLocalEvents]);

  return {
    userLocation, locationError,
    selectedCity, setSelectedCity,
    activeCenter,
    worldCities: WORLD_CITIES,
    flights, flightsLoading, flightsError,
    traffic, trafficLoading, trafficError,
    incidents, earthquakes, events, weatherAlerts, crimeIncidents, localEvents,
    refetchFlights: fetchFlights,
    refetchTraffic: fetchTraffic,
  };
}
