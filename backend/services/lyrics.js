/**
 * Synced lyrics via LRCLIB (https://lrclib.net/docs).
 * No API key. Identify client with User-Agent / Lrclib-Client.
 */

const LRCLIB_API = 'https://lrclib.net/api/get';
const CLIENT_ID = 'DisplayProject/1.0 (https://github.com/fisayo/DisplayProject)';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** @type {Map<string, { expiresAt: number, value: object|null }>} */
const lyricsCache = new Map();

/**
 * Parse LRC synced lyrics into timed lines.
 * @param {string|null|undefined} syncedLyrics
 * @returns {{ t: number, text: string }[]}
 */
function parseSyncedLyrics(syncedLyrics) {
  if (!syncedLyrics || typeof syncedLyrics !== 'string') return [];

  const lines = [];
  const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/gm;
  let match;
  while ((match = re.exec(syncedLyrics)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const frac = match[3] || '0';
    const msPart =
      frac.length === 1
        ? parseInt(frac, 10) * 100
        : frac.length === 2
          ? parseInt(frac, 10) * 10
          : parseInt(frac.padEnd(3, '0').slice(0, 3), 10);
    const t = minutes * 60_000 + seconds * 1000 + msPart;
    const text = String(match[4] || '').trim();
    if (!text) continue;
    lines.push({ t, text });
  }

  lines.sort((a, b) => a.t - b.t);
  return lines;
}

function cacheKey(track) {
  if (track?.id) return `id:${track.id}`;
  const name = String(track?.name || '').toLowerCase();
  const artist = String(track?.artists?.[0] || '').toLowerCase();
  const duration = Math.round(Number(track?.durationMs || 0) / 1000);
  return `sig:${name}|${artist}|${duration}`;
}

function getCached(key) {
  const entry = lyricsCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    lyricsCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key, value) {
  lyricsCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

/**
 * Fetch synced lyrics for a Spotify-mapped track.
 * @param {{ id?: string|null, name: string, artists?: string[], albumName?: string, durationMs?: number|null }} track
 * @returns {Promise<{ lines: { t: number, text: string }[], source: 'lrclib' }|null>}
 */
async function fetchSyncedLyrics(track) {
  if (!track?.name || !Array.isArray(track.artists) || track.artists.length === 0) {
    return null;
  }
  if (track.durationMs == null || Number.isNaN(Number(track.durationMs))) {
    return null;
  }

  const key = cacheKey(track);
  const cached = getCached(key);
  if (cached !== undefined) {
    return cached;
  }

  const durationSec = Math.round(Number(track.durationMs) / 1000);
  const params = new URLSearchParams({
    track_name: track.name,
    artist_name: track.artists[0],
    album_name: track.albumName || track.name,
    duration: String(durationSec),
  });

  let response;
  try {
    response = await fetch(`${LRCLIB_API}?${params}`, {
      headers: {
        'User-Agent': CLIENT_ID,
        'Lrclib-Client': CLIENT_ID,
      },
    });
  } catch (error) {
    console.error('LRCLIB request failed:', error.message);
    setCached(key, null);
    return null;
  }

  if (response.status === 404) {
    setCached(key, null);
    return null;
  }

  if (!response.ok) {
    console.error(`LRCLIB failed (${response.status})`);
    // Do not cache hard failures long — allow retry next poll cycle via short miss
    setCached(key, null);
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!data || data.instrumental === true) {
    setCached(key, null);
    return null;
  }

  const lines = parseSyncedLyrics(data.syncedLyrics);
  if (lines.length === 0) {
    setCached(key, null);
    return null;
  }

  const payload = { lines, source: 'lrclib' };
  setCached(key, payload);
  return payload;
}

function resetLyricsCache() {
  lyricsCache.clear();
}

module.exports = {
  parseSyncedLyrics,
  fetchSyncedLyrics,
  resetLyricsCache,
  cacheKey,
};
