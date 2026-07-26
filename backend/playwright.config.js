const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const E2E_SETTINGS = path.join(__dirname, 'e2e', '.tmp', 'settings.json');

const serverEnv = {
  ...process.env,
  PORT: String(PORT),
  HOST: '127.0.0.1',
  CONTROL_API_KEY: process.env.CONTROL_API_KEY || 'test-control-key',
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || 'test',
  NEWS_API_KEY: process.env.NEWS_API_KEY || 'test',
  STOCK_API_KEY: process.env.STOCK_API_KEY || 'test',
  DISPLAY_SETTINGS_PATH: E2E_SETTINGS,
};

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run build:client && npm start',
    cwd: __dirname,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: serverEnv,
  },
});
