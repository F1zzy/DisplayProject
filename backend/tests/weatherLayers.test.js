describe('weatherLayers', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.WEATHER_LAYERS;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.WEATHER_LAYERS;
    } else {
      process.env.WEATHER_LAYERS = originalEnv;
    }
    jest.resetModules();
  });

  test('returns disabled payload when WEATHER_LAYERS=false', async () => {
    process.env.WEATHER_LAYERS = 'false';
    const weatherLayers = require('../services/weatherLayers');
    weatherLayers.resetWeatherLayersCache();

    const result = await weatherLayers.getGlobeLayers();
    expect(result.available).toBe(false);
    expect(result.disabled).toBe(true);
    expect(result.radarUrl).toBeNull();
    expect(result.satelliteUrl).toBeNull();
    expect(result.attribution).toContain('RainViewer');
  });

  test('falls back to empty payload when compose fails', async () => {
    process.env.WEATHER_LAYERS = 'true';
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    });

    const weatherLayers = require('../services/weatherLayers');
    weatherLayers.resetWeatherLayersCache();
    const fs = require('fs');
    const path = require('path');
    for (const name of ['radar.png', 'satellite.png', 'meta.json']) {
      try {
        fs.unlinkSync(path.join(weatherLayers.CACHE_DIR, name));
      } catch {
        /* missing is fine */
      }
    }

    const result = await weatherLayers.getGlobeLayers();
    expect(result.available).toBe(false);
    expect(result.radarUrl).toBeNull();
    expect(result.satelliteUrl).toBeNull();
  });

  test('mercatorToEquirect produces expected size and clears near-black', () => {
    const weatherLayers = require('../services/weatherLayers');
    const mercW = 4;
    const mercH = 4;
    const raw = Buffer.alloc(mercW * mercH * 4, 0);
    raw[0] = 255;
    raw[1] = 10;
    raw[2] = 10;
    raw[3] = 255;

    const out = weatherLayers.mercatorToEquirect(raw, mercW, mercH, 8, 4);
    expect(out.length).toBe(8 * 4 * 4);
    expect(out[out.length - 1]).toBe(0);
  });

  test('irToCloudOverlay maps luminance to alpha', () => {
    const weatherLayers = require('../services/weatherLayers');
    const raw = Buffer.from([0, 0, 0, 255, 255, 255, 255, 255]);
    const out = weatherLayers.irToCloudOverlay(raw, 2, 1);
    expect(out[3]).toBe(0);
    expect(out[7]).toBeGreaterThan(0);
    expect(out[4]).toBeGreaterThan(200);
  });

  test('fillEmptyPixels replaces only near-black gaps', () => {
    const weatherLayers = require('../services/weatherLayers');
    const target = Buffer.from([0, 0, 0, 255, 40, 80, 120, 255]);
    const fill = Buffer.from([200, 200, 210, 255, 1, 1, 1, 255]);
    weatherLayers.fillEmptyPixels(target, fill);
    expect([...target.slice(0, 4)]).toEqual([200, 200, 210, 255]);
    expect([...target.slice(4, 8)]).toEqual([40, 80, 120, 255]);
  });

  test('mergeCloudFrames prefers brighter cloud pixels', () => {
    const weatherLayers = require('../services/weatherLayers');
    const target = Buffer.from([30, 30, 30, 255, 80, 80, 80, 255]);
    const fill = Buffer.from([220, 220, 230, 255, 20, 20, 20, 255]);
    weatherLayers.mergeCloudFrames(target, fill);
    expect([...target.slice(0, 4)]).toEqual([220, 220, 230, 255]);
    expect([...target.slice(4, 8)]).toEqual([80, 80, 80, 255]);
  });
});
