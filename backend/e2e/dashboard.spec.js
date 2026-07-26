const { test, expect } = require('@playwright/test');
const { stubApis, unlockRemote, ensureDisplayOn } = require('./helpers');

test.describe('Dashboard', () => {
  test.afterEach(async ({ request }) => {
    await ensureDisplayOn(request);
  });

  test('loads shell with clock and humidity', async ({ page }) => {
    await stubApis(page);
    await page.goto('/');
    await expect(page.locator('.App')).toBeVisible();
    await expect(page.locator('.dashboard-header')).toBeVisible();
    await expect(page.getByText('Humidity', { exact: true })).toBeVisible();
  });

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('sleep from remote blanks the dashboard', async ({ browser }) => {
    const dashboard = await browser.newPage();
    const remote = await browser.newPage();

    await stubApis(dashboard);
    await dashboard.goto('/');
    await expect(dashboard.locator('.App')).toBeVisible();

    await unlockRemote(remote);
    await remote.locator('[data-action="sleep"]').click();
    await expect(remote.locator('#status')).toContainText(/Display set to sleep/i);
    await expect(remote.locator('#powerStateBadge')).toHaveText('SLEEP');

    await expect(dashboard.locator('.display-sleep--sleep')).toBeVisible();

    await remote.locator('[data-action="on"]').click();
    await expect(dashboard.locator('.App')).toBeVisible();

    await dashboard.close();
    await remote.close();
  });
});
