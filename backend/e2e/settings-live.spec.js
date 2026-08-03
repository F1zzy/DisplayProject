const { test, expect } = require('@playwright/test');
const { stubApis, unlockRemote, openRemoteSettings } = require('./helpers');

test.describe('Settings live update', () => {
  test('saving location updates dashboard weather requests via WebSocket', async ({
    browser,
  }) => {
    const dashboard = await browser.newPage();
    const remote = await browser.newPage();
    const uniqueLocation = `E2ETown-${Date.now()}`;

    await stubApis(dashboard);

    const weatherSeen = dashboard.waitForRequest(
      (req) =>
        req.url().includes('/api/weather/current') &&
        req.url().includes(encodeURIComponent(uniqueLocation)),
      { timeout: 20_000 }
    );

    await dashboard.goto('/');
    await expect(dashboard.locator('.App')).toBeVisible();

    await unlockRemote(remote);
    await openRemoteSettings(remote);
    await remote.locator('#settingLocation').fill(uniqueLocation);
    await remote.locator('.settings-group', { hasText: 'Layout' }).locator('summary').click();
    await remote.locator('#settingDensity').selectOption('compact');
    await remote.locator('#saveSettingsBtn').click();
    await expect(remote.locator('#status')).toContainText(/Settings saved/i);

    await weatherSeen;
    await expect(dashboard.locator('.App')).toHaveClass(/density-compact/);

    const settingsRes = await remote.request.get('/api/settings');
    expect(settingsRes.ok()).toBeTruthy();
    const settings = await settingsRes.json();
    expect(settings.location).toBe(uniqueLocation);
    expect(settings.density).toBe('compact');

    await dashboard.close();
    await remote.close();
  });
});
