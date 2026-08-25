const api = require('./api');
const settings = require('./settings');

const POSITIONS_SECONDS = 90;
const CACHE_TTL_MS = 40 * 1000;
const TRACK_STEP = 5; // subsample every N seconds for the trail
const FALLBACK_OBSERVER = { latitude: 52.95, longitude: -1.15 };
const KNOWN_NAMES = {
  29155: 'GOES 13',
};

let memoryCache = null;
let inFlight = null;

function getApiKey() {
  const raw = process.env.N2YO_API_KEY;
  if (raw == null) return '';
  return String(raw).trim();
}

function isEnabled() {
  const key = getApiKey();
  if (!key) return false;
  const lower = key.toLowerCase();
  if (lower === 'false' || lower === '0' || lower === 'off') return false;
  return true;
}

function catalogFromSettings() {
  const ids = settings.getSettings().globeSatellites || [29155];
  return ids.map((id) => ({
    id: Number(id),
    name: KNOWN_NAMES[Number(id)] || `NORAD ${id}`,
  }));
}

async function resolveObserver() {
  if (process.env.SKY_LAT && process.env.SKY_LON) {
    return {
      latitude: Number(process.env.SKY_LAT),
      longitude: Number(process.env.SKY_LON),
    };
  }
  try {
    const location = settings.getSettings().location;
    const coords = await api.getLocationCoordinates(location);
    return {
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
    };
  } catch (error) {
    console.warn('n2yo: falling back to default observer:', error.message);
    return { ...FALLBACK_OBSERVER };
  }
}

function normalizePositions(id, fallbackName, payload) {
  const positions = Array.isArray(payload?.positions) ? payload.positions : [];
  if (!positions.length) return null;

  const infoName = payload?.info?.satname;
  const name = (infoName && String(infoName).trim()) || fallbackName || KNOWN_NAMES[id] || `NORAD ${id}`;

  const mapped = positions
    .map((p) => ({
      lat: Number(p.satlatitude),
      lon: Number(p.satlongitude),
      altKm: Number(p.sataltitude),
      timestamp: Number(p.timestamp),
    }))
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Number.isFinite(p.altKm) &&
        Number.isFinite(p.timestamp)
    );

  if (!mapped.length) return null;

  const current = mapped[0];
  const track = mapped.filter((_, index) => index === 0 || index % TRACK_STEP === 0 || index === mapped.length - 1);

  return {
    id: Number(payload?.info?.satid) || Number(id),
    name,
    lat: current.lat,
    lon: current.lon,
    altKm: current.altKm,
    timestamp: current.timestamp,
    track,
  };
}

async function fetchSatellitePositions(id, name, observer, apiKey) {
  const url =
    `https://api.n2yo.com/rest/v1/satellite/positions/` +
    `${id}/${observer.latitude}/${observer.longitude}/0/${POSITIONS_SECONDS}/` +
    `&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`n2yo HTTP ${response.status}`);
  }
  const data = await response.json();
  return normalizePositions(id, name, data);
}

/**
 * Modeled ground-track positions for configured NORAD IDs.
 * Soft-disabled without N2YO_API_KEY; soft-fails per satellite.
 */
async function getSatellitePositions() {
  if (!isEnabled()) {
    return {
      satellites: [],
      disabled: true,
      attribution: 'Tracking © n2yo.com',
    };
  }

  const now = Date.now();
  if (memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.payload;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const apiKey = getApiKey();
    const catalog = catalogFromSettings();
    const observer = await resolveObserver();
    const satellites = [];

    for (const sat of catalog) {
      try {
        const normalized = await fetchSatellitePositions(sat.id, sat.name, observer, apiKey);
        if (normalized) satellites.push(normalized);
      } catch (error) {
        console.warn(`n2yo: failed for NORAD ${sat.id}:`, error.message);
      }
    }

    const payload = {
      satellites,
      disabled: false,
      attribution: 'Tracking © n2yo.com',
      fetchedAt: new Date().toISOString(),
    };
    memoryCache = { fetchedAt: Date.now(), payload };
    return payload;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

function resetN2yoCache() {
  memoryCache = null;
  inFlight = null;
}

module.exports = {
  isEnabled,
  getSatellitePositions,
  normalizePositions,
  resetN2yoCache,
  KNOWN_NAMES,
  POSITIONS_SECONDS,
  CACHE_TTL_MS,
};
