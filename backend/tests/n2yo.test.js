describe('n2yo', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.N2YO_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.N2YO_API_KEY;
    } else {
      process.env.N2YO_API_KEY = originalKey;
    }
    jest.resetModules();
  });

  test('returns disabled payload when N2YO_API_KEY is unset', async () => {
    process.env.N2YO_API_KEY = '';
    jest.resetModules();
    const n2yo = require('../services/n2yo');
    n2yo.resetN2yoCache();

    const result = await n2yo.getSatellitePositions();
    expect(result.disabled).toBe(true);
    expect(result.satellites).toEqual([]);
    expect(result.attribution).toContain('n2yo');
  });

  test('returns disabled payload when N2YO_API_KEY=false', async () => {
    process.env.N2YO_API_KEY = 'false';
    jest.resetModules();
    const n2yo = require('../services/n2yo');
    n2yo.resetN2yoCache();

    const result = await n2yo.getSatellitePositions();
    expect(result.disabled).toBe(true);
    expect(result.satellites).toEqual([]);
  });

  test('normalizePositions maps n2yo payload to track + current', () => {
    process.env.N2YO_API_KEY = '';
    jest.resetModules();
    const n2yo = require('../services/n2yo');
    const normalized = n2yo.normalizePositions(29155, 'GOES 13', {
      info: { satname: 'GOES 13', satid: 29155 },
      positions: [
        {
          satlatitude: 0.1,
          satlongitude: -75.2,
          sataltitude: 35786.4,
          timestamp: 1700000000,
        },
        {
          satlatitude: 0.11,
          satlongitude: -75.21,
          sataltitude: 35786.5,
          timestamp: 1700000001,
        },
        {
          satlatitude: 0.12,
          satlongitude: -75.22,
          sataltitude: 35786.6,
          timestamp: 1700000005,
        },
      ],
    });

    expect(normalized).toMatchObject({
      id: 29155,
      name: 'GOES 13',
      lat: 0.1,
      lon: -75.2,
      altKm: 35786.4,
      timestamp: 1700000000,
    });
    expect(normalized.track.length).toBeGreaterThanOrEqual(2);
    expect(normalized.track[0]).toMatchObject({ lat: 0.1, lon: -75.2 });
  });

  test('fetches and caches satellite positions', async () => {
    process.env.N2YO_API_KEY = 'test-key';
    process.env.SKY_LAT = '52.95';
    process.env.SKY_LON = '-1.15';

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        info: { satname: 'GOES 13', satid: 29155, transactionscount: 1 },
        positions: [
          {
            satlatitude: -1.2,
            satlongitude: -89.5,
            sataltitude: 35790,
            timestamp: 1700000100,
          },
          {
            satlatitude: -1.21,
            satlongitude: -89.51,
            sataltitude: 35790,
            timestamp: 1700000101,
          },
        ],
      }),
    }));

    jest.resetModules();
    const n2yo = require('../services/n2yo');
    n2yo.resetN2yoCache();

    const first = await n2yo.getSatellitePositions();
    expect(first.disabled).toBe(false);
    expect(first.satellites).toHaveLength(1);
    expect(first.satellites[0].name).toBe('GOES 13');
    expect(first.satellites[0].id).toBe(29155);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain('/positions/29155/');
    expect(String(global.fetch.mock.calls[0][0])).toContain('apiKey=test-key');

    const second = await n2yo.getSatellitePositions();
    expect(second.satellites[0].lat).toBe(-1.2);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    delete process.env.SKY_LAT;
    delete process.env.SKY_LON;
  });

  test('soft-fails a bad satellite without aborting the batch', async () => {
    process.env.N2YO_API_KEY = 'test-key';
    process.env.SKY_LAT = '52.95';
    process.env.SKY_LON = '-1.15';

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
    }));

    jest.resetModules();
    const n2yo = require('../services/n2yo');
    n2yo.resetN2yoCache();
    const result = await n2yo.getSatellitePositions();
    expect(result.disabled).toBe(false);
    expect(result.satellites).toEqual([]);

    delete process.env.SKY_LAT;
    delete process.env.SKY_LON;
  });
});
