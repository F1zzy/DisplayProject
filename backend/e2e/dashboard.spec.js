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

  const LAYOUT_VIEWPORTS = [
    { width: 720, height: 1280 },
    { width: 1080, height: 1920 },
    { width: 1440, height: 2560 },
    { width: 1920, height: 1080 },
  ];

  const LAYOUT_WIDGETS = [
    { key: 'stock', selector: '.stock-market-widget', label: 'Stocks' },
    { key: 'news', selector: '.news-widget', label: 'News' },
    { key: 'timetable', selector: '.timetable-widget', label: 'Schedule' },
    { key: 'network', selector: '.network-stats-widget', label: 'Network' },
    { key: 'sky', selector: '.night-sky-widget', label: 'Night Sky' },
    { key: 'spotify', selector: '.spotify-widget', label: 'Spotify' },
    { key: 'f1', selector: '.f1-widget', label: 'Formula 1' },
    { key: 'globe', selector: '.world-globe-widget', label: 'World' },
  ];

  async function noScrollOverflow(page, selector) {
    return page.locator(selector).evaluate((el) => {
      const dx = el.scrollWidth - el.clientWidth;
      const dy = el.scrollHeight - el.clientHeight;
      return {
        ok: dx <= 2 && dy <= 2,
        dx,
        dy,
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
      };
    });
  }

  async function fitsInside(page, selector, containerSelector) {
    return page.evaluate(
      ({ selector: sel, containerSelector: boxSel }) => {
        const el = document.querySelector(sel);
        const box = document.querySelector(boxSel);
        if (!el || !box) return { ok: false, reason: 'missing' };
        const a = el.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        const tol = 2;
        const overflow = {
          left: Number((b.left - a.left).toFixed(2)),
          top: Number((b.top - a.top).toFixed(2)),
          right: Number((a.right - b.right).toFixed(2)),
          bottom: Number((a.bottom - b.bottom).toFixed(2)),
        };
        return {
          ok:
            overflow.left <= tol &&
            overflow.top <= tol &&
            overflow.right <= tol &&
            overflow.bottom <= tol,
          overflow,
        };
      },
      { selector, containerSelector }
    );
  }

  test('kiosk shell and widgets fit common portrait and landscape frames', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await stubApis(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const enabledWidgets = LAYOUT_WIDGETS.map((item) => item.key);
    const updated = await request.put('/api/settings', {
      headers: { 'x-api-key': CONTROL_KEY, 'Content-Type': 'application/json' },
      data: { enabledWidgets, widgetRotationMs: 0 },
    });
    expect(updated.ok()).toBeTruthy();

    await request.post('/api/display/widgets/pin', {
      headers: { 'x-api-key': CONTROL_KEY, 'Content-Type': 'application/json' },
      data: { pinned: true, index: 0 },
    });

    await page.goto('/');
    await expect(page.locator('.App')).toBeVisible();

    for (const viewport of LAYOUT_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.locator('.App')).toBeVisible();

      const appOverflow = await noScrollOverflow(page, '.App');
      expect(
        appOverflow.ok,
        `App overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(appOverflow)}`
      ).toBe(true);

      for (const section of ['.dashboard-header', '.dashboard-weather', '.dashboard-widgets']) {
        const fit = await fitsInside(page, section, '.App');
        expect(
          fit.ok,
          `${section} outside .App at ${viewport.width}x${viewport.height}: ${JSON.stringify(fit)}`
        ).toBe(true);
      }

      const clockOverflow = await noScrollOverflow(page, '.time-container-time');
      expect(
        clockOverflow.ok,
        `clock panel overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(clockOverflow)}`
      ).toBe(true);

      const clockFit = await fitsInside(page, '.clock-face', '.time-container-time');
      expect(
        clockFit.ok,
        `clock face outside panel at ${viewport.width}x${viewport.height}: ${JSON.stringify(clockFit)}`
      ).toBe(true);

      if (viewport.width === 720 && viewport.height === 1280) {
        const statsCols = await page
          .locator('.time-container-dateCon')
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(statsCols).toBe(2);

        const forecastRow = page.locator('.forecast-row');
        if (await forecastRow.count()) {
          const forecastCols = await forecastRow.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
          );
          expect(forecastCols).toBe(3);
        }
      }

      if (viewport.width === 1080 && viewport.height === 1920) {
        const statsCols = await page
          .locator('.time-container-dateCon')
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        expect(statsCols).toBe(4);
      }

      for (const [index, widget] of LAYOUT_WIDGETS.entries()) {
        await request.post('/api/display/widgets/set', {
          headers: { 'x-api-key': CONTROL_KEY, 'Content-Type': 'application/json' },
          data: { index },
        });
        await expect(page.locator('.widget-display')).toHaveAttribute(
          'aria-label',
          `${widget.label} widget`
        );
        const root = page.locator(
          `${widget.selector}, .widget-display .error-boundary-fallback`
        );
        await expect(root.first()).toBeVisible();
        await page.waitForTimeout(200);

        const widgetOverflow = await noScrollOverflow(page, '.widget-display');
        expect(
          widgetOverflow.ok,
          `${widget.key} overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(widgetOverflow)}`
        ).toBe(true);

        const measuredFit = (await page.locator(widget.selector).count())
          ? await fitsInside(page, widget.selector, '.widget-display')
          : await fitsInside(page, '.widget-display .error-boundary-fallback', '.widget-display');
        expect(
          measuredFit.ok,
          `${widget.key} outside stage at ${viewport.width}x${viewport.height}: ${JSON.stringify(measuredFit)}`
        ).toBe(true);
      }
    }
  });

  test('landscape clock fits a small panel with xl type', async ({ page, request }) => {
    await stubApis(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const updated = await request.put('/api/settings', {
      headers: { 'x-api-key': CONTROL_KEY, 'Content-Type': 'application/json' },
      data: { clockSize: 'small', clockFontSize: 'xl', density: 'roomy' },
    });
    expect(updated.ok()).toBeTruthy();

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('.clock-face')).toBeVisible();
      await expect(page.locator('.App')).toHaveClass(/clock-size-small/);
      await expect(page.locator('.App')).toHaveClass(/clock-font-xl/);

      const clockOverflow = await noScrollOverflow(page, '.time-container-time');
      expect(
        clockOverflow.ok,
        `clock panel overflow at ${viewport.width}x${viewport.height}: ${JSON.stringify(clockOverflow)}`
      ).toBe(true);

      const clockFit = await fitsInside(page, '.clock-face', '.time-container-time');
      expect(
        clockFit.ok,
        `clock face outside panel at ${viewport.width}x${viewport.height}: ${JSON.stringify(clockFit)}`
      ).toBe(true);
    }
  });
});
