const request = require('supertest');
const { app } = require('../server');
const calendar = require('../services/calendar');
const networkStats = require('../services/networkStats');
const sky = require('../services/sky');
const spotify = require('../services/spotify');

describe('API routes', () => {
  test('GET /api/health returns ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('Calendar API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/calendar/events returns 503 when not configured', async () => {
    jest.spyOn(calendar, 'isConfigured').mockReturnValue(false);

    const response = await request(app).get('/api/calendar/events');
    expect(response.status).toBe(503);
    expect(response.body.configured).toBe(false);
    expect(response.body.events).toEqual([]);
    expect(response.body.error).toMatch(/not configured/i);
  });

  test('GET /api/calendar/events returns events when configured', async () => {
    jest.spyOn(calendar, 'isConfigured').mockReturnValue(true);
    jest.spyOn(calendar, 'getUpcomingEvents').mockResolvedValue([
      {
        id: '1',
        time: '09:00',
        endTime: '09:30',
        title: 'Standup',
        location: 'Remote',
        allDay: false,
        start: '2026-07-14T09:00:00Z',
      },
    ]);

    const response = await request(app).get('/api/calendar/events?days=1');
    expect(response.status).toBe(200);
    expect(response.body.configured).toBe(true);
    expect(response.body.events).toHaveLength(1);
    expect(response.body.events[0].title).toBe('Standup');
  });
});

describe('Network API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/network/stats returns stats payload', async () => {
    jest.spyOn(networkStats, 'getNetworkStats').mockResolvedValue({
      online: true,
      latencyMs: 18,
      checkedAt: '2026-07-14T12:00:00.000Z',
      lastOnlineAt: '2026-07-14T12:00:00.000Z',
      interface: null,
      rxBps: null,
      txBps: null,
    });

    const response = await request(app).get('/api/network/stats');
    expect(response.status).toBe(200);
    expect(response.body.online).toBe(true);
    expect(response.body.latencyMs).toBe(18);
  });
});

describe('Sky API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/sky/current returns night sky payload', async () => {
    jest.spyOn(sky, 'getNightSky').mockResolvedValue({
      location: 'Nottingham',
      latitude: 52.95,
      longitude: -1.15,
      observedAt: '2026-07-14T21:00:00.000Z',
      chartUrl: 'https://example.com/chart.png',
      chartStyle: 'navy',
      bodies: [{ name: 'Moon', altitude: 40, azimuth: 120, magnitude: -10 }],
      configured: { chart: true, planets: true },
      errors: { chart: null, planets: null },
    });

    const response = await request(app).get('/api/sky/current');
    expect(response.status).toBe(200);
    expect(response.body.chartUrl).toContain('chart.png');
    expect(response.body.bodies[0].name).toBe('Moon');
  });
});

describe('Spotify API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/spotify/now returns 503 when not configured', async () => {
    jest.spyOn(spotify, 'isConfigured').mockReturnValue(false);

    const response = await request(app).get('/api/spotify/now');
    expect(response.status).toBe(503);
    expect(response.body.configured).toBe(false);
    expect(response.body.track).toBeNull();
  });

  test('GET /api/spotify/now returns payload when configured', async () => {
    jest.spyOn(spotify, 'isConfigured').mockReturnValue(true);
    jest.spyOn(spotify, 'getNowPlayingPayload').mockResolvedValue({
      configured: true,
      playing: true,
      track: {
        id: '1',
        name: 'Test Track',
        artists: ['Tester'],
        albumName: 'Demo',
        albumArt: 'https://example.com/a.jpg',
        durationMs: 180000,
        uri: 'spotify:track:1',
      },
      progressMs: 30000,
      topTracks: [],
      fetchedAt: '2026-07-16T12:00:00.000Z',
    });

    const response = await request(app).get('/api/spotify/now');
    expect(response.status).toBe(200);
    expect(response.body.playing).toBe(true);
    expect(response.body.track.name).toBe('Test Track');
  });
});

describe('Display control', () => {
  const apiKey = process.env.CONTROL_API_KEY || 'change-me';

  test('GET /api/display/state returns display state', async () => {
    const response = await request(app).get('/api/display/state');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('power');
    expect(response.body).toHaveProperty('widgetCount');
    expect(response.body).toHaveProperty('pinned');
  });

  test('POST /api/display/auth/verify requires auth', async () => {
    const response = await request(app).post('/api/display/auth/verify').send({});
    expect(response.status).toBe(401);
  });

  test('POST /api/display/auth/verify accepts valid key', async () => {
    const response = await request(app)
      .post('/api/display/auth/verify')
      .set('x-api-key', apiKey)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  test('POST /api/display/power requires auth', async () => {
    const response = await request(app)
      .post('/api/display/power')
      .send({ action: 'on' });

    expect(response.status).toBe(401);
  });

  test('POST /api/display/power updates state with valid key', async () => {
    const response = await request(app)
      .post('/api/display/power')
      .set('x-api-key', apiKey)
      .send({ action: 'sleep' });

    expect(response.status).toBe(200);
    expect(response.body.power).toBe('sleep');
  });

  test('POST /api/control-display legacy endpoint works with valid key', async () => {
    const response = await request(app)
      .post('/api/control-display')
      .set('x-api-key', apiKey)
      .send({ action: 'on' });

    expect(response.status).toBe(200);
  });

  test('POST /api/display/widgets/pin toggles pin and rotate clears it', async () => {
    const pinned = await request(app)
      .post('/api/display/widgets/pin')
      .set('x-api-key', apiKey)
      .send({ pinned: true });

    expect(pinned.status).toBe(200);
    expect(pinned.body.pinned).toBe(true);

    const state = await request(app).get('/api/display/state');
    expect(state.body.pinned).toBe(true);

    const rotated = await request(app)
      .post('/api/display/widgets/rotate')
      .set('x-api-key', apiKey)
      .send({});

    expect(rotated.status).toBe(200);
    expect(rotated.body.pinned).toBe(false);
  });

  test('POST /api/display/widgets/pin can pin a chosen widget index', async () => {
    const pinned = await request(app)
      .post('/api/display/widgets/pin')
      .set('x-api-key', apiKey)
      .send({ pinned: true, index: 1 });

    expect(pinned.status).toBe(200);
    expect(pinned.body.pinned).toBe(true);
    expect(pinned.body.currentWidget).toBe(1);

    const invalid = await request(app)
      .post('/api/display/widgets/pin')
      .set('x-api-key', apiKey)
      .send({ pinned: true, index: 99 });

    expect(invalid.status).toBe(400);
  });

  test('POST /api/display/widgets/pin requires auth', async () => {
    const response = await request(app).post('/api/display/widgets/pin').send({ pinned: true });
    expect(response.status).toBe(401);
  });
});

describe('Settings API', () => {
  const apiKey = process.env.CONTROL_API_KEY || 'change-me';
  const settingsService = require('../services/settings');
  const fs = require('fs');
  let backup = null;

  beforeEach(() => {
    if (fs.existsSync(settingsService.SETTINGS_PATH)) {
      backup = fs.readFileSync(settingsService.SETTINGS_PATH, 'utf8');
      fs.unlinkSync(settingsService.SETTINGS_PATH);
    } else {
      backup = null;
    }
    settingsService.resetSettingsCache();
  });

  afterEach(() => {
    if (fs.existsSync(settingsService.SETTINGS_PATH)) {
      fs.unlinkSync(settingsService.SETTINGS_PATH);
    }
    if (backup !== null) {
      fs.writeFileSync(settingsService.SETTINGS_PATH, backup, 'utf8');
    }
    settingsService.resetSettingsCache();
  });

  test('GET /api/settings returns settings shape', async () => {
    const response = await request(app).get('/api/settings');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('location');
    expect(response.body).toHaveProperty('enabledWidgets');
    expect(response.body).toHaveProperty('stockSymbols');
  });

  test('PUT /api/settings requires auth', async () => {
    const response = await request(app).put('/api/settings').send({ location: 'Leeds' });
    expect(response.status).toBe(401);
  });

  test('PUT /api/settings updates with valid key', async () => {
    const response = await request(app)
      .put('/api/settings')
      .set('x-api-key', apiKey)
      .send({
        location: 'Leeds',
        enabledWidgets: ['stock', 'network'],
        widgetRotationMs: 30000,
      });

    expect(response.status).toBe(200);
    expect(response.body.location).toBe('Leeds');
    expect(response.body.enabledWidgets).toEqual(['stock', 'network']);

    const state = await request(app).get('/api/display/state');
    expect(state.body.widgetCount).toBe(2);
  });
});
