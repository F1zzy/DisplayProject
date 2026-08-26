const presence = require('../services/presence');
const settings = require('../services/settings');
const displayControl = require('../services/displayControl');

jest.mock('../services/displayPower', () => ({
  setDisplayPower: jest.fn(),
}));

describe('applyFromStatus', () => {
  test('wakes sleep when home', () => {
    expect(presence.applyFromStatus({ home: true, away: false, power: 'sleep' })).toBe('on');
  });

  test('sleeps when away and on', () => {
    expect(presence.applyFromStatus({ home: false, away: true, power: 'on' })).toBe('sleep');
  });

  test('does not sleep before grace (away false)', () => {
    expect(presence.applyFromStatus({ home: false, away: false, power: 'on' })).toBeNull();
  });

  test('skips when already asleep and away', () => {
    expect(presence.applyFromStatus({ home: false, away: true, power: 'sleep' })).toBeNull();
  });

  test('does not change power while off', () => {
    expect(presence.applyFromStatus({ home: true, away: false, power: 'off' })).toBeNull();
    expect(presence.applyFromStatus({ home: false, away: true, power: 'off' })).toBeNull();
  });
});

describe('presence tick', () => {
  const previousEnv = process.env.PRESENCE_SERVICE_URL;

  afterEach(() => {
    presence.resetForTests();
    jest.restoreAllMocks();
    if (previousEnv === undefined) {
      delete process.env.PRESENCE_SERVICE_URL;
    } else {
      process.env.PRESENCE_SERVICE_URL = previousEnv;
    }
  });

  function mockSettings(partial) {
    jest.spyOn(settings, 'getSettings').mockReturnValue({
      presenceEnabled: true,
      presenceHost: '10.255.255.50',
      presenceIntervalMs: 15000,
      presenceAwayAfterMs: 30000,
      enabledWidgets: ['stock'],
      ...partial,
    });
  }

  function jsonResponse(payload, ok = true) {
    return {
      ok,
      json: async () => payload,
    };
  }

  test('sleeps after away then wakes on home', async () => {
    process.env.PRESENCE_SERVICE_URL = 'http://127.0.0.1:3012';
    mockSettings();
    const applied = [];
    let power = 'on';
    let snapshot = {
      enabled: true,
      host: '10.255.255.50',
      home: false,
      away: true,
    };
    presence.configure({
      getPower: () => power,
      applyPower: (action) => {
        applied.push(action);
        power = action;
      },
      fetch: async () => jsonResponse(snapshot),
    });

    await presence.tick();
    expect(applied).toEqual(['sleep']);
    expect(presence.getStatus().home).toBe(false);

    snapshot = { ...snapshot, home: true, away: false };
    await presence.tick();
    expect(applied).toEqual(['sleep', 'on']);
    expect(presence.getStatus().home).toBe(true);
  });

  test('does not apply power when disabled, host empty, or service unset', async () => {
    const applyPower = jest.fn();
    const fetch = jest.fn(async () => jsonResponse({ enabled: false, home: false, away: true }));

    mockSettings({ presenceEnabled: false, presenceHost: '10.255.255.50' });
    process.env.PRESENCE_SERVICE_URL = 'http://127.0.0.1:3012';
    presence.configure({ applyPower, getPower: () => 'on', fetch });
    await presence.tick();
    expect(applyPower).not.toHaveBeenCalled();

    mockSettings({ presenceEnabled: true, presenceHost: '' });
    await presence.tick();
    expect(applyPower).not.toHaveBeenCalled();

    mockSettings();
    process.env.PRESENCE_SERVICE_URL = 'false';
    await presence.tick();
    expect(applyPower).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('does not wake or sleep when display is off', async () => {
    process.env.PRESENCE_SERVICE_URL = 'http://127.0.0.1:3012';
    mockSettings();
    const applyPower = jest.fn();
    presence.configure({
      applyPower,
      getPower: () => 'off',
      fetch: async () =>
        jsonResponse({
          enabled: true,
          host: '10.255.255.50',
          home: false,
          away: true,
        }),
    });
    await presence.tick();
    expect(applyPower).not.toHaveBeenCalled();

    presence.configure({
      applyPower,
      getPower: () => 'off',
      fetch: async () =>
        jsonResponse({
          enabled: true,
          host: '10.255.255.50',
          home: true,
          away: false,
        }),
    });
    await presence.tick();
    expect(applyPower).not.toHaveBeenCalled();
  });

  test('fail-open when Go is unreachable', async () => {
    process.env.PRESENCE_SERVICE_URL = 'http://127.0.0.1:3012';
    mockSettings();
    const applyPower = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    presence.configure({
      applyPower,
      getPower: () => 'on',
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    await presence.tick();
    expect(applyPower).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('displayControl presence source', () => {
  beforeEach(() => {
    displayControl.resetState();
    displayControl.configure({ broadcast: () => {} });
  });

  test('presence cannot override manual off', () => {
    displayControl.applyPower('off');
    const result = displayControl.applyPower('on', { source: 'presence' });
    expect(result.state.power).toBe('off');
    expect(result.changed).toBe(false);
  });

  test('presence never sends off', () => {
    displayControl.applyPower('on');
    const result = displayControl.applyPower('off', { source: 'presence' });
    expect(result.state.power).toBe('on');
  });

  test('presence can sleep and wake', () => {
    expect(displayControl.applyPower('sleep', { source: 'presence' }).state.power).toBe('sleep');
    expect(displayControl.applyPower('on', { source: 'presence' }).state.power).toBe('on');
  });
});
