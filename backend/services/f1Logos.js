const LOGO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_SEASON = '2026';

/**
 * Constructor logos from F1's media CDN.
 *
 * Most Jolpica constructor ids match F1's own slug once underscores are
 * removed, so only the mismatches are listed here. The older
 * `fom-website/teams/<year>/` paths are not usable: they 404 for teams that
 * joined after that year's directory was published.
 */
const CONSTRUCTOR_SLUGS = {
  red_bull: 'redbullracing',
  rb: 'racingbulls',
  aston_martin: 'astonmartin',
};

/**
 * Live timing identifies a team by name, not by id, and words it differently
 * from Jolpica ("Red Bull Racing" against "Red Bull"). Keys are normalised to
 * bare lowercase letters; anything unrecognised falls back to the normalised
 * name, which happens to be the right CDN slug for most teams.
 */
const TEAM_NAME_IDS = {
  alpine: 'alpine',
  alpinef1team: 'alpine',
  astonmartin: 'aston_martin',
  audi: 'audi',
  cadillac: 'cadillac',
  cadillacf1team: 'cadillac',
  ferrari: 'ferrari',
  haas: 'haas',
  haasf1team: 'haas',
  mclaren: 'mclaren',
  mercedes: 'mercedes',
  racingbulls: 'rb',
  rb: 'rb',
  rbf1team: 'rb',
  redbull: 'red_bull',
  redbullracing: 'red_bull',
  williams: 'williams',
};

const cache = new Map();

/** Map a team name from live timing onto a constructor id. */
function resolveConstructorId(teamName) {
  const normalised = String(teamName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!normalised) return null;
  return TEAM_NAME_IDS[normalised] || normalised;
}

function slugFor(constructorId) {
  const id = String(constructorId || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (!id) return null;
  return CONSTRUCTOR_SLUGS[id] || id.replace(/_/g, '');
}

function logoUrl(slug, season) {
  const year = /^\d{4}$/.test(String(season)) ? String(season) : DEFAULT_SEASON;
  return `https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/${year}/${slug}/${year}${slug}logowhite.webp`;
}

/**
 * Fetch a constructor logo, memoised for a week.
 * @returns {Promise<{body: Buffer, contentType: string}|null>} null when unknown or unavailable.
 */
async function getLogo(constructorId, season = DEFAULT_SEASON) {
  const slug = slugFor(constructorId);
  if (!slug) return null;

  const key = `${season}:${slug}`;
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  // Misses are cached too, briefly, so an unrecognised team name cannot make
  // the widget re-hit the CDN on every poll of a live session.
  const remember = (value, ttl) => {
    cache.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  };

  let response;
  try {
    response = await fetch(logoUrl(slug, season), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return remember(null, MISS_TTL_MS);
  }

  if (!response.ok) return remember(null, MISS_TTL_MS);

  return remember(
    {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'image/webp',
    },
    LOGO_TTL_MS
  );
}

function resetLogoCache() {
  cache.clear();
}

module.exports = {
  CONSTRUCTOR_SLUGS,
  TEAM_NAME_IDS,
  LOGO_TTL_MS,
  getLogo,
  resolveConstructorId,
  slugFor,
  logoUrl,
  resetLogoCache,
};
