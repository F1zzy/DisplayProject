describe('getGlobeWeather', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('aggregates curated cities and soft-fails individuals', async () => {
    global.fetch = jest.fn(async (url) => {
      const href = String(url);
      if (href.includes('q=Tokyo')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
        };
      }
      const cityMatch = href.match(/q=([^&]+)/);
      const query = decodeURIComponent(cityMatch ? cityMatch[1] : 'Unknown');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          current: {
            temp_c: 18,
            humidity: 60,
            wind_kph: 12,
            condition: { text: 'Clear', icon: '//cdn.weatherapi.com/icon.png' },
          },
          location: { name: query },
        }),
      };
    });

    const api = require('../services/api');
    const ids = ['london', 'tokyo', 'sydney'];
    const result = await api.getGlobeWeather(ids);

    expect(Array.isArray(result.cities)).toBe(true);
    expect(result.cities.length).toBe(ids.length - 1);
    expect(result.cities.find((c) => c.id === 'tokyo')).toBeUndefined();
    expect(result.cities[0]).toMatchObject({
      temperature: 18,
      humidity: 60,
      windKph: 12,
      condition: 'Clear',
    });
    expect(result.cities[0]).toHaveProperty('lat');
    expect(result.cities[0]).toHaveProperty('lon');
    expect(result.cities[0]).toHaveProperty('name');
    expect(result.cities[0]).toHaveProperty('countryIso');
  });

  test('uses cache on subsequent calls for the same city', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          current: {
            temp_c: 21,
            humidity: 40,
            wind_kph: 5,
            condition: { text: 'Sunny', icon: '//cdn.x/icon.png' },
          },
        }),
      };
    });

    const api = require('../services/api');
    const ids = ['london', 'dubai'];
    const first = await api.getGlobeWeather(ids);
    const second = await api.getGlobeWeather(ids);

    expect(first.cities).toHaveLength(ids.length);
    expect(second.cities).toHaveLength(ids.length);
    expect(calls).toBe(ids.length);
  });

  test('respects a custom city selection', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        current: {
          temp_c: 10,
          humidity: 50,
          wind_kph: 8,
          condition: { text: 'Cloudy', icon: '//cdn.x/icon.png' },
        },
      }),
    }));

    const api = require('../services/api');
    const result = await api.getGlobeWeather(['paris', 'berlin', 'bogus']);

    expect(result.cities.map((c) => c.id)).toEqual(['paris', 'berlin']);
  });
});
