const ASSET_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Jolpica circuitId → F1 media CDN circuit-map slug.
 * Verified against the 2026 calendar; USA venues and Baku/Abu Dhabi diverge
 * from the country name F1 uses in the filename.
 */
const CIRCUIT_MAP_SLUGS = {
  albert_park: 'Australia',
  shanghai: 'China',
  suzuka: 'Japan',
  miami: 'Miami',
  villeneuve: 'Canada',
  monaco: 'Monaco',
  catalunya: 'Spain',
  madring: 'Spain',
  red_bull_ring: 'Austria',
  silverstone: 'Great_Britain',
  spa: 'Belgium',
  hungaroring: 'Hungary',
  zandvoort: 'Netherlands',
  monza: 'Italy',
  imola: 'Emilia_Romagna',
  baku: 'Baku',
  marina_bay: 'Singapore',
  americas: 'USA',
  rodriguez: 'Mexico',
  interlagos: 'Brazil',
  vegas: 'Las_Vegas',
  losail: 'Qatar',
  yas_marina: 'Abu_Dhabi',
  jeddah: 'Saudi_Arabia',
  bahrain: 'Bahrain',
};

/**
 * Jolpica country string → ISO 3166-1 alpha-2 for flagcdn.com.
 */
const COUNTRY_ISO = {
  Australia: 'au',
  Austria: 'at',
  Azerbaijan: 'az',
  Bahrain: 'bh',
  Belgium: 'be',
  Brazil: 'br',
  Canada: 'ca',
  China: 'cn',
  France: 'fr',
  Germany: 'de',
  Hungary: 'hu',
  India: 'in',
  Italy: 'it',
  Japan: 'jp',
  Korea: 'kr',
  Malaysia: 'my',
  Mexico: 'mx',
  Monaco: 'mc',
  Netherlands: 'nl',
  Portugal: 'pt',
  Qatar: 'qa',
  Russia: 'ru',
  'Saudi Arabia': 'sa',
  Singapore: 'sg',
  Spain: 'es',
  Switzerland: 'ch',
  Turkey: 'tr',
  UAE: 'ae',
  UK: 'gb',
  USA: 'us',
};

const cache = new Map();

function circuitMapUrl(slug) {
  return `https://media.formula1.com/image/upload/c_fit,h_120/q_auto/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${encodeURIComponent(slug)}_Circuit.png`;
}

function flagUrl(iso) {
  return `https://flagcdn.com/w40/${iso}.png`;
}

function slugForCircuit(circuitId) {
  const id = String(circuitId || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (!id) return null;
  return CIRCUIT_MAP_SLUGS[id] || null;
}

function isoForCountry(country) {
  const name = String(country || '').trim();
  if (!name) return null;
  return COUNTRY_ISO[name] || null;
}

async function fetchCached(key, url, contentTypeFallback) {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const remember = (value, ttl) => {
    cache.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  };

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    return remember(null, MISS_TTL_MS);
  }

  if (!response.ok) return remember(null, MISS_TTL_MS);

  return remember(
    {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || contentTypeFallback,
    },
    ASSET_TTL_MS
  );
}

/**
 * @returns {Promise<{body: Buffer, contentType: string}|null>}
 */
async function getCircuitMap(circuitId) {
  const slug = slugForCircuit(circuitId);
  if (!slug) return null;
  return fetchCached(`circuit:${slug}`, circuitMapUrl(slug), 'image/png');
}

/**
 * @returns {Promise<{body: Buffer, contentType: string}|null>}
 */
async function getCountryFlag(country) {
  const iso = isoForCountry(country);
  if (!iso) return null;
  return fetchCached(`flag:${iso}`, flagUrl(iso), 'image/png');
}

function resetMediaCache() {
  cache.clear();
}

module.exports = {
  ASSET_TTL_MS,
  CIRCUIT_MAP_SLUGS,
  COUNTRY_ISO,
  getCircuitMap,
  getCountryFlag,
  slugForCircuit,
  isoForCountry,
  circuitMapUrl,
  flagUrl,
  resetMediaCache,
};
