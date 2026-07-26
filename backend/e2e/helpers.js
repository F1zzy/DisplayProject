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
      body: JSON.stringify(STUB_FORECAST),
    });
  });
  await page.route('**/api/weather/hourly**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_HOURLY),
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
      body: JSON.stringify({ articles: [] }),
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
  expectUnlocked,
  ensureDisplayOn,
  STUB_WEATHER_CURRENT,
  STUB_F1,
  STUB_LOGO,
};
