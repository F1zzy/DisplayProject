require('dotenv').config();

const cache = require('./cache');

const STANDINGS_TTL_MS = 30 * 60 * 1000;
const BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const CACHE_KEY = 'f1:championships';
const REQUEST_TIMEOUT_MS = 12000;

let inFlight = null;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Flatten an Ergast/Jolpica DriverStandings list.
 * @param {object} payload Parsed `/driverstandings.json` body.
 */
function mapDriverStandings(payload) {
  const list = payload?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows = list?.DriverStandings;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const driver = row?.Driver || {};
    const constructor = Array.isArray(row?.Constructors) ? row.Constructors[0] : null;
    return {
      position: toNumber(row?.position),
      driverId: driver.driverId || null,
      code: driver.code || (driver.familyName || '').slice(0, 3).toUpperCase() || null,
      givenName: driver.givenName || '',
      familyName: driver.familyName || '',
      number: toNumber(driver.permanentNumber),
      constructor: constructor?.name || null,
      constructorId: constructor?.constructorId || null,
      points: toNumber(row?.points) ?? 0,
      wins: toNumber(row?.wins) ?? 0,
    };
  });
}

/**
 * Flatten an Ergast/Jolpica ConstructorStandings list.
 * @param {object} payload Parsed `/constructorstandings.json` body.
 */
function mapConstructorStandings(payload) {
  const list = payload?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows = list?.ConstructorStandings;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    position: toNumber(row?.position),
    constructorId: row?.Constructor?.constructorId || null,
    name: row?.Constructor?.name || null,
    nationality: row?.Constructor?.nationality || null,
    points: toNumber(row?.points) ?? 0,
    wins: toNumber(row?.wins) ?? 0,
  }));
}

function readSeasonMeta(payload) {
  const table = payload?.MRData?.StandingsTable;
  const list = table?.StandingsLists?.[0];
  return {
    season: list?.season || table?.season || null,
    round: toNumber(list?.round ?? table?.round),
  };
}

async function fetchJson(path) {
  // The `.json` suffix is required — without it Jolpica serves its browsable HTML API.
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Jolpica request failed (${response.status}) for ${path}`);
  }

  return response.json();
}

async function loadChampionships() {
  const [driversPayload, constructorsPayload] = await Promise.all([
    fetchJson('/current/driverstandings.json?limit=30'),
    fetchJson('/current/constructorstandings.json?limit=30'),
  ]);

  const meta = readSeasonMeta(driversPayload);

  return {
    season: meta.season,
    round: meta.round,
    drivers: mapDriverStandings(driversPayload),
    constructors: mapConstructorStandings(constructorsPayload),
    fetchedAt: new Date().toISOString(),
  };
}

async function getChampionships() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  if (inFlight) return inFlight;

  inFlight = loadChampionships()
    .then((result) => {
      cache.set(CACHE_KEY, result, STANDINGS_TTL_MS);
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

module.exports = {
  getChampionships,
  mapDriverStandings,
  mapConstructorStandings,
  readSeasonMeta,
};
