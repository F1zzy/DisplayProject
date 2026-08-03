const {
  parseSyncedLyrics,
  fetchSyncedLyrics,
  resetLyricsCache,
} = require('../services/lyrics');

describe('lyrics helpers', () => {
  afterEach(() => {
    resetLyricsCache();
    jest.restoreAllMocks();
  });

  test('parseSyncedLyrics extracts timed lines', () => {
    const lrc = `[00:17.12] I feel your breath upon my neck
[00:21.50] Something else
[03:20.31] The clock won't stop
[03:25.72] 
`;
    expect(parseSyncedLyrics(lrc)).toEqual([
      { t: 17120, text: 'I feel your breath upon my neck' },
      { t: 21500, text: 'Something else' },
      { t: 200310, text: "The clock won't stop" },
    ]);
  });

  test('parseSyncedLyrics returns empty for missing input', () => {
    expect(parseSyncedLyrics(null)).toEqual([]);
    expect(parseSyncedLyrics('')).toEqual([]);
    expect(parseSyncedLyrics('no timestamps here')).toEqual([]);
  });

  test('fetchSyncedLyrics returns null on 404 then empty search', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ code: 404 }),
      })
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ code: 404 }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [],
      });

    const result = await fetchSyncedLyrics({
      id: 't1',
      name: 'Unknown Song',
      artists: ['Nobody'],
      albumName: 'Void',
      durationMs: 180000,
    });

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Cached miss — second call does not hit network
    const again = await fetchSyncedLyrics({
      id: 't1',
      name: 'Unknown Song',
      artists: ['Nobody'],
      albumName: 'Void',
      durationMs: 180000,
    });
    expect(again).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('fetchSyncedLyrics falls back to search when /get misses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ code: 404 }),
      })
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ code: 404 }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [
          {
            instrumental: false,
            duration: 201,
            syncedLyrics: '[00:05.00] From search\n[00:10.00] Line two\n',
          },
        ],
      });

    const result = await fetchSyncedLyrics({
      id: 'search-hit',
      name: 'Hello',
      artists: ['Artist'],
      albumName: 'Wrong Album',
      durationMs: 200000,
    });

    expect(result).toEqual({
      source: 'lrclib',
      lines: [
        { t: 5000, text: 'From search' },
        { t: 10000, text: 'Line two' },
      ],
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('fetchSyncedLyrics returns parsed lines from LRCLIB', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        instrumental: false,
        syncedLyrics: '[00:05.00] Hello world\n[00:10.00] Line two\n',
        plainLyrics: 'Hello world\nLine two\n',
      }),
    });

    const result = await fetchSyncedLyrics({
      id: 'abc',
      name: 'Hello',
      artists: ['Artist'],
      albumName: 'Album',
      durationMs: 200000,
    });

    expect(result).toEqual({
      source: 'lrclib',
      lines: [
        { t: 5000, text: 'Hello world' },
        { t: 10000, text: 'Line two' },
      ],
    });
  });

  test('fetchSyncedLyrics returns null for instrumental', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        instrumental: true,
        syncedLyrics: null,
        plainLyrics: null,
      }),
    });

    const result = await fetchSyncedLyrics({
      id: 'inst',
      name: 'Beat',
      artists: ['DJ'],
      albumName: 'Beats',
      durationMs: 120000,
    });

    expect(result).toBeNull();
  });

  test('fetchSyncedLyrics returns null for plain-only lyrics', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        instrumental: false,
        syncedLyrics: null,
        plainLyrics: 'Just words\nNo timing\n',
      }),
    });

    const result = await fetchSyncedLyrics({
      id: 'plain',
      name: 'Words',
      artists: ['Poet'],
      albumName: 'Book',
      durationMs: 150000,
    });

    expect(result).toBeNull();
  });
});
