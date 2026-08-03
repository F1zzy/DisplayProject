require('dotenv').config();

const cache = require('./cache');
const api = require('./api');

const SKY_TTL_MS = 45 * 60 * 1000;
const ASTRONOMY_APP_ID = process.env.ASTRONOMY_APP_ID || '';
const ASTRONOMY_APP_SECRET = process.env.ASTRONOMY_APP_SECRET || '';
const STAR_CHART_URL = 'https://api.astronomyapi.com/api/v2/studio/star-chart';
const POSITIONS_URL = 'https://api.astronomyapi.com/api/v2/bodies/positions';

/** Bodies useful for a night-sky strip (exclude Sun / Earth). */
const STRIP_BODY_IDS = new Set([
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]);

const inFlight = new Map();

function hasChartCredentials() {
  return Boolean(ASTRONOMY_APP_ID && ASTRONOMY_APP_SECRET);
}

function astronomyAuthHeader() {
  const token = Buffer.from(`${ASTRONOMY_APP_ID}:${ASTRONOMY_APP_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Approximate RA/Dec of the local zenith for centering an area star chart.
 * @param {number} latitude
 * @param {number} longitude
 * @param {Date} date
 */
function getZenithEquatorial(latitude, longitude, date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  let gmst = 18.697374558 + 24.06570982441908 * d;
  gmst = ((gmst % 24) + 24) % 24;
  const lst = (((gmst + longitude / 15) % 24) + 24) % 24;
  return {
    rightAscension: Number(lst.toFixed(4)),
    declination: Number(Number(latitude).toFixed(4)),
  };
}

function observerDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function observerTimeString(date = new Date()) {
  return date.toISOString().slice(11, 19);
}

async function resolveObserver(locationName) {
  if (process.env.SKY_LAT && process.env.SKY_LON) {
    return {
      location: locationName,
      latitude: Number(process.env.SKY_LAT),
      longitude: Number(process.env.SKY_LON),
    };
  }

  const coords = await api.getLocationCoordinates(locationName);
  return {
    location: coords.name || locationName,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

function parseAltitude(cell) {
  const horizontal = cell?.position?.horizontal || cell?.position?.horizonal;
  const raw = horizontal?.altitude?.degrees;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseAzimuth(cell) {
  const horizontal = cell?.position?.horizontal || cell?.position?.horizonal;
  const raw = horizontal?.azimuth?.degrees;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBodiesFromPositions(payload) {
  const rows = payload?.data?.table?.rows;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const id = String(row?.entry?.id || '').toLowerCase();
      if (!STRIP_BODY_IDS.has(id)) return null;

      const cell = Array.isArray(row.cells) ? row.cells[0] : null;
      if (!cell) return null;

      const altitude = parseAltitude(cell);
      if (altitude == null || altitude <= 0) return null;

      const magnitudeRaw = cell.extraInfo?.magnitude;
      const magnitude =
        magnitudeRaw == null || magnitudeRaw === '' ? null : Number(magnitudeRaw);

      return {
        name: cell.name || row.entry?.name || id,
        constellation: cell.position?.constellation?.name || null,
        altitude,
        azimuth: parseAzimuth(cell),
        magnitude: Number.isFinite(magnitude) ? magnitude : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const magA = a.magnitude == null ? 99 : a.magnitude;
      const magB = b.magnitude == null ? 99 : b.magnitude;
      return magA - magB;
    });
}

async function fetchVisibleBodies(latitude, longitude, date = new Date()) {
  if (!hasChartCredentials()) {
    throw new Error('AstronomyAPI credentials are not configured');
  }

  const day = observerDateString(date);
  const time = observerTimeString(date);
  const url =
    `${POSITIONS_URL}?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    '&elevation=0' +
    `&from_date=${encodeURIComponent(day)}` +
    `&to_date=${encodeURIComponent(day)}` +
    `&time=${encodeURIComponent(time)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: astronomyAuthHeader(),
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AstronomyAPI positions failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  return parseBodiesFromPositions(payload);
}

async function fetchStarChart(latitude, longitude, date = new Date()) {
  if (!hasChartCredentials()) {
    return null;
  }

  const zenith = getZenithEquatorial(latitude, longitude, date);
  const response = await fetch(STAR_CHART_URL, {
    method: 'POST',
    headers: {
      Authorization: astronomyAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Inverted: dark points on light field — blends onto the widget with mix-blend-mode
      style: 'inverted',
      observer: {
        latitude,
        longitude,
        date: observerDateString(date),
      },
      view: {
        type: 'area',
        parameters: {
          position: {
            equatorial: zenith,
          },
          zoom: 3,
        },
      },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AstronomyAPI star-chart failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  return payload?.data?.imageUrl || null;
}

async function loadNightSky(locationName) {
  const now = new Date();
  const observer = await resolveObserver(locationName);

  let bodies = [];
  let bodiesError = null;
  try {
    bodies = await fetchVisibleBodies(observer.latitude, observer.longitude, now);
  } catch (error) {
    console.error('Night sky bodies:', error.message || error);
    bodiesError = error.message || String(error);
  }

  let chartUrl = null;
  let chartError = null;
  try {
    chartUrl = await fetchStarChart(observer.latitude, observer.longitude, now);
  } catch (error) {
    console.error('Night sky chart:', error.message || error);
    chartError = error.message || String(error);
  }

  return {
    location: observer.location,
    latitude: observer.latitude,
    longitude: observer.longitude,
    observedAt: now.toISOString(),
    chartUrl,
    chartStyle: 'inverted',
    bodies,
    configured: {
      chart: hasChartCredentials(),
      planets: hasChartCredentials() && !bodiesError,
    },
    errors: {
      chart: chartError,
      planets: bodiesError,
    },
  };
}

async function getNightSky(locationName) {
  const cacheKey = `sky:current:v2:${locationName}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const pending = loadNightSky(locationName)
    .then((result) => {
      cache.set(cacheKey, result, SKY_TTL_MS);
      return result;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, pending);
  return pending;
}

module.exports = {
  getNightSky,
  getZenithEquatorial,
  hasChartCredentials,
  fetchVisibleBodies,
  fetchStarChart,
  parseBodiesFromPositions,
};
