import { useState, useEffect, useCallback, useRef } from 'react';

export const WORLD_CITIES = [
  { id: 'nyc',     label: 'NYC',     lat: 40.7128,  lon: -74.0060,  name: 'New York'    },
  { id: 'london',  label: 'London',  lat: 51.5074,  lon: -0.1278,   name: 'London'      },
  { id: 'tokyo',   label: 'Tokyo',   lat: 35.6762,  lon: 139.6503,  name: 'Tokyo'       },
  { id: 'paris',   label: 'Paris',   lat: 48.8566,  lon: 2.3522,    name: 'Paris'       },
  { id: 'dubai',   label: 'Dubai',   lat: 25.2048,  lon: 55.2708,   name: 'Dubai'       },
  { id: 'sydney',  label: 'Sydney',  lat: -33.8688, lon: 151.2093,  name: 'Sydney'      },
];

const FLIGHT_REFRESH = 15_000;  // 15s — matches OpenSky rate limit
const TRAFFIC_REFRESH = 60_000; // 60s

function bboxFromCenter(lat, lon, deg = 2) {
  return {
    lamin: lat - deg,
    lomin: lon - deg,
    lamax: lat + deg,
    lomax: lon + deg,
  };
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
  // User location (from ip-api.com)
  const [userLocation, setUserLocation] = useState(null);  // { lat, lon, city }
  const [locationError, setLocationError] = useState(null);

  // Selected city (null = user location)
  const [selectedCity, setSelectedCity] = useState(null);

  // Flights
  const [flights, setFlights] = useState([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState(null);

  // Traffic
  const [traffic, setTraffic] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState(null);

  const flightTimer = useRef(null);

  // Derive active center from selected city or user location
  const activeCenter = selectedCity
    ? { lat: selectedCity.lat, lon: selectedCity.lon, label: selectedCity.label }
    : userLocation
      ? { lat: userLocation.lat, lon: userLocation.lon, label: userLocation.city }
      : { lat: WORLD_CITIES[0].lat, lon: WORLD_CITIES[0].lon, label: WORLD_CITIES[0].label };

  // Fetch user geolocation via ip-api.com (no auth, 45 req/min)
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    fetchWithTimeout('http://ip-api.com/json/?fields=lat,lon,city,status')
      .then(data => {
        if (data.status === 'success') {
          setUserLocation({ lat: data.lat, lon: data.lon, city: data.city });
        } else {
          setLocationError('Geolocation unavailable');
        }
      })
      .catch(err => {
        setLocationError(err.message);
        // Fallback to first world city — handled via activeCenter default above
      });
  }, []);

  // Fetch flights for active center
  const fetchFlights = useCallback(async () => {
    setFlightsLoading(true);
    setFlightsError(null);
    const bbox = bboxFromCenter(activeCenter.lat, activeCenter.lon);
    try {
      const data = await fetchWithTimeout(
        `/api/flights?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`
      );
      setFlights(data.states ?? []);
    } catch (err) {
      setFlightsError(err.message);
    } finally {
      setFlightsLoading(false);
    }
  }, [activeCenter.lat, activeCenter.lon]);

  // Fetch traffic for active center
  const fetchTraffic = useCallback(async () => {
    setTrafficLoading(true);
    setTrafficError(null);
    try {
      const data = await fetchWithTimeout(
        `/api/traffic?lat=${activeCenter.lat}&lon=${activeCenter.lon}`
      );
      setTraffic(data);
    } catch (err) {
      setTrafficError(err.message);
    } finally {
      setTrafficLoading(false);
    }
  }, [activeCenter.lat, activeCenter.lon]);

  // Set up polling for flights + traffic
  useEffect(() => {
    fetchFlights();
    fetchTraffic();

    const flightInterval = setInterval(fetchFlights, FLIGHT_REFRESH);
    const trafficInterval = setInterval(fetchTraffic, TRAFFIC_REFRESH);
    return () => {
      clearInterval(flightInterval);
      clearInterval(trafficInterval);
    };
  }, [fetchFlights, fetchTraffic]);

  return {
    userLocation,
    locationError,
    selectedCity,
    setSelectedCity,
    activeCenter,
    worldCities: WORLD_CITIES,
    flights,
    flightsLoading,
    flightsError,
    traffic,
    trafficLoading,
    trafficError,
    refetchFlights: fetchFlights,
    refetchTraffic: fetchTraffic,
  };
}
