const spotify = require('../services/spotify');

describe('spotify helpers', () => {
  test('mapTrack maps Spotify track payload', () => {
    const mapped = spotify.mapTrack({
      id: 'abc',
      name: 'Song',
      duration_ms: 210000,
      uri: 'spotify:track:abc',
      artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
      album: {
        name: 'Album',
        images: [{ url: 'https://example.com/art.jpg' }],
      },
    });

    expect(mapped).toEqual({
      id: 'abc',
      name: 'Song',
      artists: ['Artist A', 'Artist B'],
      albumName: 'Album',
      albumArt: 'https://example.com/art.jpg',
      durationMs: 210000,
      uri: 'spotify:track:abc',
    });
  });

  test('mapTrack returns null for empty input', () => {
    expect(spotify.mapTrack(null)).toBeNull();
  });

  test('isConfigured reflects env credentials', () => {
    const prev = {
      id: process.env.SPOTIFY_CLIENT_ID,
      secret: process.env.SPOTIFY_CLIENT_SECRET,
      refresh: process.env.SPOTIFY_REFRESH_TOKEN,
    };

    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    expect(spotify.isConfigured()).toBe(false);

    process.env.SPOTIFY_CLIENT_ID = 'id';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
    process.env.SPOTIFY_REFRESH_TOKEN = 'refresh';
    expect(spotify.isConfigured()).toBe(true);

    process.env.SPOTIFY_CLIENT_ID = prev.id;
    process.env.SPOTIFY_CLIENT_SECRET = prev.secret;
    process.env.SPOTIFY_REFRESH_TOKEN = prev.refresh;
  });
});
