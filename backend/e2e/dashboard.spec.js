const { test, expect } = require('@playwright/test');
const { stubApis, unlockRemote, ensureDisplayOn, CONTROL_KEY } = require('./helpers');

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

  test('shows F1 championship standings when the widget is selected', async ({ page, request }) => {
    await stubApis(page);
    await page.goto('/');
    await expect(page.locator('.App')).toBeVisible();

    // A settings file left over from an earlier run may predate this widget.
    let settings = await (await request.get('/api/settings')).json();
    if (!settings.enabledWidgets.includes('f1')) {
      const updated = await request.put('/api/settings', {
        headers: { 'x-api-key': CONTROL_KEY, 'Content-Type': 'application/json' },
        data: { enabledWidgets: [...settings.enabledWidgets, 'f1'] },
      });
      settings = await updated.json();
    }

    const index = settings.enabledWidgets.indexOf('f1');
    expect(index).toBeGreaterThanOrEqual(0);

    await request.post('/api/display/widgets/set', {
      headers: { 'x-api-key': CONTROL_KEY, 'Content-Type': 'application/json' },
      data: { index },
    });

    const widget = page.locator('.f1-widget');
    await expect(widget).toBeVisible();
    await expect(page.getByText('Constructor', { exact: true })).toBeVisible();
    await expect(widget.locator('.f1-code').first()).toHaveText('ANT');
    await expect(widget.locator('.f1-row--driver').first()).toContainText('Antonelli');

    await expect(widget.locator('.f1-next')).toContainText('Dutch Grand Prix');
    await expect(widget.locator('.f1-next')).toContainText('Zandvoort');

    // Gained a place, lost a place, and unchanged all render distinctly.
    await expect(widget.locator('.f1-delta--up').first()).toBeVisible();
    await expect(widget.locator('.f1-delta--down').first()).toBeVisible();

    // A broken image still lays out, so assert the bytes actually decoded.
    for (const selector of [
      '.f1-row--team img.f1-logo',
      '.f1-row:not(.f1-row--team) img.f1-logo',
      '.f1-next img.f1-flag',
      '.f1-next img.f1-circuit',
    ]) {
      const image = widget.locator(selector).first();
      await expect(image).toBeVisible();
      expect(await image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    }
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
