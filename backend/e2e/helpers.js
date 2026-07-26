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
};
