/**
 * Spotify Web API client for Now Playing + recent + top tracks.
 * Credentials stay server-side (SPOTIFY_CLIENT_ID / SECRET / REFRESH_TOKEN).
 */

const lyricsService = require('./lyrics');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1';

let accessTokenCache = {
  token: null,
  expiresAt: 0,
};

function isConfigured() {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID &&
      process.env.SPOTIFY_CLIENT_SECRET &&
      process.env.SPOTIFY_REFRESH_TOKEN
  );
}

function mapTrack(item) {
  if (!item) return null;
  const artists = Array.isArray(item.artists)
    ? item.artists.map((a) => a.name).filter(Boolean)
    : [];
  const images = item.album?.images || [];
  const albumArt = images[0]?.url || images[1]?.url || null;
  return {
    id: item.id || null,
    name: item.name || 'Unknown track',
    artists,
    albumName: item.album?.name || '',
    albumArt,
    durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : null,
    uri: item.uri || null,
  };
}

async function refreshAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt > now + 30_000) {
    return accessTokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`Spotify token refresh failed (${response.status}) ${text}`);
    error.status = 502;
    throw error;
  }

  const data = await response.json();
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return accessTokenCache.token;
}

async function spotifyGet(path) {
  const token = await refreshAccessToken();
  const response = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`Spotify API failed (${response.status}) ${path}: ${text}`);
    error.status = response.status === 401 ? 502 : 502;
    throw error;
  }

  return response.json();
}

async function getNowPlayingPayload() {
  if (!isConfigured()) {
    const error = new Error('Spotify is not configured');
    error.status = 503;
    error.configured = false;
    throw error;
  }

  const [currentlyPlaying, topData] = await Promise.all([
    spotifyGet('/me/player/currently-playing').catch(() => null),
    spotifyGet('/me/top/tracks?time_range=short_term&limit=3').catch(() => ({ items: [] })),
  ]);

  const topTracks = Array.isArray(topData?.items)
    ? topData.items.map(mapTrack).filter(Boolean)
    : [];

  let playing = false;
  let track = null;
  let progressMs = null;

  if (
    currentlyPlaying?.is_playing === true &&
    currentlyPlaying?.item &&
    currentlyPlaying.currently_playing_type !== 'unknown'
  ) {
    playing = true;
    track = mapTrack(currentlyPlaying.item);
    progressMs =
      typeof currentlyPlaying.progress_ms === 'number' ? currentlyPlaying.progress_ms : null;
  }

  // Nothing currently playing → last listened
  if (!track) {
    const recent = await spotifyGet('/me/player/recently-played?limit=1').catch(() => null);
    const recentItem = recent?.items?.[0]?.track;
    track = mapTrack(recentItem);
    playing = false;
    progressMs = null;
  }

  let lyrics = null;
  if (playing && track) {
    try {
      lyrics = await lyricsService.fetchSyncedLyrics(track);
    } catch (error) {
      console.error('Lyrics lookup failed:', error.message);
      lyrics = null;
    }
  }

  return {
    configured: true,
    playing: Boolean(playing && track),
    track,
    progressMs: playing ? progressMs : null,
    lyrics,
    topTracks,
    fetchedAt: new Date().toISOString(),
  };
}

/** Reset token cache (tests). */
function resetSpotifyTokenCache() {
  accessTokenCache = { token: null, expiresAt: 0 };
}

module.exports = {
  isConfigured,
  mapTrack,
  getNowPlayingPayload,
  resetSpotifyTokenCache,
};
