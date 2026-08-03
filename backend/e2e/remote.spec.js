const { test, expect } = require('@playwright/test');
const { unlockRemote, openRemoteSettings, CONTROL_KEY, ensureDisplayOn } = require('./helpers');

test.describe('Remote control', () => {
  test.afterEach(async ({ request }) => {
    await ensureDisplayOn(request);
  });

  test('rejects wrong API key', async ({ page }) => {
    await page.goto('/remote');
    await page.locator('#apiKey').fill('wrong-key');
    await page.locator('#unlockBtn').click();
    await expect(page.locator('#statusPill')).toHaveText('LOCKED');
    await expect(page.locator('#controls')).toBeHidden();
  });

  test('unlocks with control key', async ({ page }) => {
    await unlockRemote(page, CONTROL_KEY);
    await expect(page.locator('body')).toHaveClass(/is-unlocked/);
    await expect(page.locator('[data-view-panel="control"]')).toBeVisible();
  });

  test('switches to settings view', async ({ page }) => {
    await unlockRemote(page);
    await openRemoteSettings(page);
    await expect(page.locator('#saveSettingsBtn')).toBeVisible();
    await expect(page.locator('#settingLocation')).toBeVisible();
  });

  test('power on / sleep / off update badge', async ({ page }) => {
    await unlockRemote(page);

    await page.locator('[data-action="on"]').click();
    await expect(page.locator('#status')).toContainText(/Display set to on/i);
    await expect(page.locator('#powerStateBadge')).toHaveText('ON');

    await page.locator('[data-action="off"]').click();
    await expect(page.locator('#powerStateBadge')).toHaveText('OFF');
  });

  test('next widget rotates', async ({ page }) => {
    await unlockRemote(page);
    await page.locator('#widgetButtons button[data-widget="rotate"]').click();
    await expect(page.locator('#status')).toContainText(/Widget rotated/i);
  });

  test('pin and unpin a widget', async ({ page }) => {
    await unlockRemote(page);
    await expect(page.locator('#pinWidgetSelect')).toBeVisible();
    await page.locator('#pinWidgetSelect').selectOption({ index: 0 });
    await page.locator('#pinWidgetBtn').click();
    await expect(page.locator('#status')).toContainText(/pinned/i);
    await expect(page.locator('#unpinWidgetBtn')).toBeVisible();

    await page.locator('#unpinWidgetBtn').click();
    await expect(page.locator('#status')).toContainText(/Widget unpinned/i);
  });
});
