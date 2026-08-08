const { normalizeStats, normalizeSummary, getBaseUrl } = require('../services/networkStats');

describe('networkStats proxy helpers', () => {
  const previousEnv = process.env.NETWORK_SERVICE_URL;

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env.NETWORK_SERVICE_URL;
    } else {
      process.env.NETWORK_SERVICE_URL = previousEnv;
    }
  });

  test('normalizeStats maps Go payload fields', () => {
    expect(
      normalizeStats({
        online: true,
        latencyMs: 18,
        checkedAt: '2026-07-14T12:00:00.000Z',
        lastOnlineAt: '2026-07-14T12:00:00.000Z',
        interface: 'eth0',
        ipv4: '192.168.1.50',
        gateway: '192.168.1.1',
        publicIp: '203.0.113.10',
        rxBps: 125000,
        txBps: 4200,
      })
    ).toEqual({
      online: true,
      latencyMs: 18,
      checkedAt: '2026-07-14T12:00:00.000Z',
      lastOnlineAt: '2026-07-14T12:00:00.000Z',
      interface: 'eth0',
      ipv4: '192.168.1.50',
      gateway: '192.168.1.1',
      publicIp: '203.0.113.10',
      rxBps: 125000,
      txBps: 4200,
    });
  });

  test('normalizeStats fills defaults for empty payloads', () => {
    const result = normalizeStats(null);
    expect(result.online).toBe(false);
    expect(result.latencyMs).toBeNull();
    expect(result.interface).toBeNull();
    expect(result.ipv4).toBeNull();
    expect(result.publicIp).toBeNull();
    expect(result.checkedAt).toBeTruthy();
  });

  test('normalizeSummary maps targets and history', () => {
    process.env.NETWORK_SERVICE_URL = 'http://127.0.0.1:3011';
    const result = normalizeSummary({
      online: true,
      latencyMs: 22,
      checkedAt: '2026-07-14T12:00:00.000Z',
      interface: 'eth0',
      ipv4: '10.0.0.2',
      publicIp: '198.51.100.9',
      rxBps: 1000,
      txBps: 200,
      windowSamples: 12,
      targets: [
        { name: 'internet', latencyMs: 22 },
        { name: 'gateway', latencyMs: null },
        { name: 'dns', latencyMs: 5 },
      ],
      history: [
        { at: '2026-07-14T11:59:00.000Z', rxBps: 900, txBps: 100, latencyMs: 20 },
      ],
    });

    expect(result.available).toBe(true);
    expect(result.windowSamples).toBe(12);
    expect(result.targets).toEqual([
      { name: 'internet', latencyMs: 22 },
      { name: 'gateway', latencyMs: null },
      { name: 'dns', latencyMs: 5 },
    ]);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].rxBps).toBe(900);
  });

  test('normalizeSummary marks unavailable when empty', () => {
    const result = normalizeSummary(null);
    expect(result.available).toBe(false);
    expect(result.targets).toEqual([]);
    expect(result.history).toEqual([]);
  });

  test('getBaseUrl respects false and defaults outside test', () => {
    process.env.NETWORK_SERVICE_URL = 'false';
    expect(getBaseUrl()).toBeNull();

    process.env.NETWORK_SERVICE_URL = 'http://127.0.0.1:3011/';
    expect(getBaseUrl()).toBe('http://127.0.0.1:3011');
  });
});
