const metrics = require('../services/metrics');
const { normalizePath, shouldSkip } = require('../middleware/metricsMiddleware');

describe('metrics service', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.ANALYTICS_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.ANALYTICS_URL;
    } else {
      process.env.ANALYTICS_URL = originalUrl;
    }
  });

  test('isEnabled is false when ANALYTICS_URL=false', () => {
    process.env.ANALYTICS_URL = 'false';
    expect(metrics.isEnabled()).toBe(false);
    expect(metrics.getBaseUrl()).toBeNull();
  });

  test('isEnabled is false in test env when ANALYTICS_URL unset', () => {
    delete process.env.ANALYTICS_URL;
    expect(process.env.NODE_ENV).toBe('test');
    expect(metrics.isEnabled()).toBe(false);
  });

  test('record does not throw when fetch fails', async () => {
    process.env.ANALYTICS_URL = 'http://127.0.0.1:3010';
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    expect(() => metrics.record({ type: 'api', path: '/api/health', method: 'GET', status: 200, duration_ms: 1 })).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(global.fetch).toHaveBeenCalled();
  });

  test('getSummary returns offline fallback when fetch fails', async () => {
    process.env.ANALYTICS_URL = 'http://127.0.0.1:3010';
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const summary = await metrics.getSummary();
    expect(summary.available).toBe(false);
    expect(summary.totals.apiCalls).toBe(0);
    expect(summary.mostViewedWidget).toBeNull();
  });

  test('getSummary merges remote payload', async () => {
    process.env.ANALYTICS_URL = 'http://127.0.0.1:3010';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mostViewedWidget: { key: 'spotify', views: 3 },
        windowHours: 24,
        totals: { apiCalls: 10, widgetViews: 3 },
      }),
    });
    const summary = await metrics.getSummary();
    expect(summary.available).toBe(true);
    expect(summary.mostViewedWidget.key).toBe('spotify');
    expect(summary.totals.apiCalls).toBe(10);
  });
});

describe('metrics middleware helpers', () => {
  test('shouldSkip analytics and health paths', () => {
    expect(shouldSkip('/api/health')).toBe(true);
    expect(shouldSkip('/api/analytics/summary')).toBe(true);
    expect(shouldSkip('/api/weather/current')).toBe(false);
  });

  test('normalizePath collapses dynamic F1 asset routes', () => {
    expect(normalizePath('/api/f1/logo/mercedes')).toBe('/api/f1/logo/:constructorId');
    expect(normalizePath('/api/f1/circuit/monza?x=1')).toBe('/api/f1/circuit/:circuitId');
    expect(normalizePath('/api/stocks?symbols=AAPL')).toBe('/api/stocks');
  });
});
