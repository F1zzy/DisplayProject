const CONTROL_KEY = process.env.CONTROL_API_KEY || 'test-control-key';

const STUB_WEATHER_CURRENT = {
  location: 'E2E City',
  temperature: 12,
  humidity: 55,
  condition: 'Partly cloudy',
  conditionCode: 1003,
  iconUrl: '//cdn.weatherapi.com/weather/64x64/day/116.png',
};

const STUB_FORECAST = {
  forecast: [
    {
      date: new Date().toISOString().split('T')[0],
      day: {
        mintemp_c: 8,
        maxtemp_c: 14,
        condition: { text: 'Cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/119.png' },
      },
      astro: { sunrise: '06:00 AM', sunset: '08:00 PM' },
    },
    {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      day: {
        mintemp_c: 7,
        maxtemp_c: 13,
        condition: { text: 'Rain', icon: '//cdn.weatherapi.com/weather/64x64/day/296.png' },
      },
      astro: { sunrise: '06:01 AM', sunset: '08:01 PM' },
    },
    {
      date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      day: {
        mintemp_c: 6,
        maxtemp_c: 12,
        condition: { text: 'Sunny', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png' },
      },
      astro: { sunrise: '06:02 AM', sunset: '08:02 PM' },
    },
  ],
};

const STUB_HOURLY = {
  hours: Array.from({ length: 12 }, (_, i) => ({
    time: `${String(i + 8).padStart(2, '0')}:00`,
    temp_c: 10 + i,
    condition: { text: 'Cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/119.png' },
    chance_of_rain: 10,
    wind_dir: 'N',
  })),
};

const STUB_F1 = {
  season: '2026',
  round: 11,
  drivers: [
    {
      position: 1,
      driverId: 'antonelli',
      code: 'ANT',
      givenName: 'Andrea Kimi',
      familyName: 'Antonelli',
      constructor: 'Mercedes',
      constructorId: 'mercedes',
      points: 219,
      wins: 6,
      positionChange: 1,
    },
    {
      position: 2,
      driverId: 'hamilton',
      code: 'HAM',
      givenName: 'Lewis',
      familyName: 'Hamilton',
      constructor: 'Ferrari',
      constructorId: 'ferrari',
      points: 169,
      wins: 1,
      positionChange: -1,
    },
  ],
  constructors: [
    {
      position: 1,
      constructorId: 'mercedes',
      name: 'Mercedes',
      points: 379,
      wins: 7,
      positionChange: 0,
    },
    {
      position: 2,
      constructorId: 'ferrari',
      name: 'Ferrari',
      points: 288,
      wins: 2,
      positionChange: null,
    },
  ],
  nextRace: {
    round: 12,
    raceName: 'Dutch Grand Prix',
    circuitId: 'zandvoort',
    circuitName: 'Circuit Park Zandvoort',
    locality: 'Zandvoort',
    country: 'Netherlands',
    // Kept relative so the countdown never renders as a past race.
    startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    qualifying: null,
    sprint: null,
  },
  fetchedAt: new Date().toISOString(),
  live: { active: false, order: [] },
};

/** 1x1 transparent PNG, so the logo route never reaches F1's CDN in tests. */
const STUB_LOGO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAX+xLzwAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Stub flaky third-party-backed API routes so E2E does not need live keys.
 * @param {import('@playwright/test').Page} page
 */
async function stubApis(page) {
  await page.route('**/api/weather/current**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_WEATHER_CURRENT),
    });
  });
  await page.route('**/api/weather/forecast**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_FORECAST.forecast),
    });
  });
  await page.route('**/api/weather/hourly**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_HOURLY.hours),
    });
  });
  await page.route('**/api/weather/globe-layers**', async (route) => {
    const url = route.request().url();
    if (url.includes('.png')) {
      // 1×1 transparent PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      await route.fulfill({ status: 200, contentType: 'image/png', body: png });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        radarUrl: '/api/weather/globe-layers/radar.png',
        satelliteUrl: '/api/weather/globe-layers/satellite.png',
        radarTs: Date.now(),
        satelliteDate: '2026-08-06',
        attribution: 'Radar © RainViewer · Imagery NASA GIBS',
      }),
    });
  });
  await page.route('**/api/weather/globe**', async (route) => {
    if (route.request().url().includes('globe-layers')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cities: [
          {
            id: 'london',
            name: 'London',
            country: 'UK',
            countryIso: '826',
            lat: 51.5074,
            lon: -0.1278,
            temperature: 14,
            humidity: 70,
            windKph: 18,
            condition: 'Cloudy',
            iconUrl: '//cdn.weatherapi.com/weather/64x64/day/119.png',
          },
          {
            id: 'tokyo',
            name: 'Tokyo',
            country: 'Japan',
            countryIso: '392',
            lat: 35.6762,
            lon: 139.6503,
            temperature: 26,
            humidity: 55,
            windKph: 10,
            condition: 'Clear',
            iconUrl: '//cdn.weatherapi.com/weather/64x64/day/113.png',
          },
        ],
      }),
    });
  });
  await page.route('**/api/stocks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ symbols: ['AAPL'], data: [null] }),
    });
  });
  await page.route('**/api/news**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          title: 'City council approves new riverside park',
          description: 'A short summary that should wrap inside the news card without overflowing.',
          url: 'https://example.com/news/1',
          urlToImage: null,
          source: { name: 'Example News' },
        },
        {
          title: 'Local rail line adds weekend services',
          description: 'Second story used to fill the headlines column on the kiosk.',
          url: 'https://example.com/news/2',
          urlToImage: null,
          source: { name: 'Daily Wire' },
        },
        {
          title: 'Warm spell expected through Thursday',
          description: 'Third headline so the general list occupies its flex rows.',
          url: 'https://example.com/news/3',
          urlToImage: null,
          source: { name: 'Weather Desk' },
        },
        {
          title: 'Chipmakers report stronger quarter',
          description: 'Technology column item one.',
          url: 'https://example.com/news/4',
          urlToImage: null,
          source: { name: 'Tech Daily' },
        },
        {
          title: 'Open-source maps add transit layer',
          description: 'Technology column item two.',
          url: 'https://example.com/news/5',
          urlToImage: null,
          source: { name: 'Open Atlas' },
        },
      ]),
    });
  });
  await page.route('**/api/calendar/**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Calendar not configured' }),
    });
  });
  await page.route('**/api/network/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ latencyMs: 12, rxMbps: 1, txMbps: 0.5 }),
    });
  });
  await page.route('**/api/sky/**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Sky not configured' }),
    });
  });
  await page.route('**/api/satellites/positions**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        satellites: [
          {
            id: 29155,
            name: 'GOES 13',
            lat: 0.1,
            lon: -75.2,
            altKm: 35786,
            timestamp: 1700000000,
            track: [
              { lat: 0.1, lon: -75.2, altKm: 35786, timestamp: 1700000000 },
              { lat: 0.12, lon: -75.25, altKm: 35786, timestamp: 1700000045 },
              { lat: 0.14, lon: -75.3, altKm: 35786, timestamp: 1700000090 },
            ],
          },
        ],
        disabled: false,
        attribution: 'Tracking © n2yo.com',
      }),
    });
  });
  await page.route('**/api/spotify/**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Spotify not configured' }),
    });
  });
  await page.route('**/api/f1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_F1),
    });
  });
  // Registered after the catch-all above, which Playwright resolves last-first.
  await page.route('**/api/f1/logo/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: STUB_LOGO,
    });
  });
  await page.route('**/api/f1/circuit/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: STUB_LOGO,
    });
  });
  await page.route('**/api/f1/flag/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: STUB_LOGO,
    });
  });
}

/**
 * Unlock the remote control page.
 * @param {import('@playwright/test').Page} page
 * @param {string} [apiKey]
 */
async function unlockRemote(page, apiKey = CONTROL_KEY) {
  await page.goto('/remote');
  await page.locator('#apiKey').fill(apiKey);
  await page.locator('#unlockBtn').click();
  await expectUnlocked(page);
}

/**
 * Switch the remote to the Settings view (after unlock).
 * @param {import('@playwright/test').Page} page
 */
async function openRemoteSettings(page) {
  await page.locator('[data-remote-view="settings"]').click();
  await page.locator('[data-view-panel="settings"]').waitFor({ state: 'visible' });
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function expectUnlocked(page) {
  await page.locator('#statusPill').waitFor({ state: 'visible' });
  await page.locator('#statusPill').filter({ hasText: 'UNLOCKED' }).waitFor();
  await page.locator('#controls').waitFor({ state: 'visible' });
  await page.locator('#status').filter({ hasText: /Unlocked/i }).waitFor();
}

/**
 * Reset display power so later specs see the dashboard shell.
 * @param {import('@playwright/test').APIRequestContext} request
 */
async function ensureDisplayOn(request) {
  await request.post('/api/display/power', {
    headers: {
      'x-api-key': CONTROL_KEY,
      'Content-Type': 'application/json',
    },
    data: { action: 'on' },
  });
}

module.exports = {
  CONTROL_KEY,
  stubApis,
  unlockRemote,
  openRemoteSettings,
  expectUnlocked,
  ensureDisplayOn,
  STUB_WEATHER_CURRENT,
  STUB_F1,
  STUB_LOGO,
};
