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

/** Combine an Ergast date + time pair into an ISO instant. */
function toInstant(date, time) {
  if (!date) return null;
  const iso = time ? `${date}T${time.replace(/Z?$/, 'Z')}` : `${date}T00:00:00Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Flatten an Ergast/Jolpica race into the next-race summary.
 * @param {object} payload Parsed `/current/next.json` body.
 */
function mapNextRace(payload) {
  const race = payload?.MRData?.RaceTable?.Races?.[0];
  if (!race) return null;

  const location = race?.Circuit?.Location || {};

  return {
    round: toNumber(race.round),
    raceName: race.raceName || null,
    circuitId: race?.Circuit?.circuitId || null,
    circuitName: race?.Circuit?.circuitName || null,
    locality: location.locality || null,
    country: location.country || null,
    startsAt: toInstant(race.date, race.time),
    qualifying: toInstant(race?.Qualifying?.date, race?.Qualifying?.time),
    sprint: toInstant(race?.Sprint?.date, race?.Sprint?.time),
  };
}

/**
 * Annotate standings rows with movement since the previous round.
 * Positive means places gained; null when the entry is new or has no history.
 */
function applyPositionChanges(rows, previousRows, idKey) {
  if (!Array.isArray(rows)) return [];

  const previous = new Map();
  if (Array.isArray(previousRows)) {
    for (const row of previousRows) {
      const id = row?.[idKey];
      if (id && row.position != null) previous.set(id, row.position);
    }
  }

  return rows.map((row) => {
    const was = previous.get(row?.[idKey]);
    return {
      ...row,
      positionChange:
        was != null && row.position != null ? was - row.position : null,
    };
  });
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

/** Standings after the previous round, used only for movement arrows. */
async function loadPreviousRound(round) {
  if (!Number.isFinite(round) || round <= 1) {
    return { drivers: [], constructors: [] };
  }

  const previous = round - 1;

  try {
    const [driversPayload, constructorsPayload] = await Promise.all([
      fetchJson(`/current/${previous}/driverstandings.json?limit=30`),
      fetchJson(`/current/${previous}/constructorstandings.json?limit=30`),
    ]);

    return {
      drivers: mapDriverStandings(driversPayload),
      constructors: mapConstructorStandings(constructorsPayload),
    };
  } catch (error) {
    // Movement arrows are a nicety; never fail the whole payload for them.
    console.error('F1 previous-round standings unavailable:', error.message);
    return { drivers: [], constructors: [] };
  }
}

async function loadChampionships() {
  const [driversPayload, constructorsPayload, nextRacePayload] = await Promise.all([
    fetchJson('/current/driverstandings.json?limit=30'),
    fetchJson('/current/constructorstandings.json?limit=30'),
    fetchJson('/current/next.json').catch((error) => {
      // Between the last race and the next season there is no "next" race.
      console.error('F1 next race unavailable:', error.message);
      return null;
    }),
  ]);

  const meta = readSeasonMeta(driversPayload);
  const previous = await loadPreviousRound(meta.round);

  return {
    season: meta.season,
    round: meta.round,
    drivers: applyPositionChanges(
      mapDriverStandings(driversPayload),
      previous.drivers,
      'driverId'
    ),
    constructors: applyPositionChanges(
      mapConstructorStandings(constructorsPayload),
      previous.constructors,
      'constructorId'
    ),
    nextRace: nextRacePayload ? mapNextRace(nextRacePayload) : null,
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
  mapNextRace,
  applyPositionChanges,
  readSeasonMeta,
};
