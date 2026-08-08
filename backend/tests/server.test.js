const request = require('supertest');
const { app } = require('../server');
const api = require('../services/api');
const calendar = require('../services/calendar');
const networkStats = require('../services/networkStats');
const sky = require('../services/sky');
const spotify = require('../services/spotify');
const f1Standings = require('../services/f1Standings');
const f1Live = require('../services/f1Live');
const f1Logos = require('../services/f1Logos');
const f1Media = require('../services/f1Media');
const metrics = require('../services/metrics');

describe('API routes', () => {
  test('GET /api/health returns ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('Globe weather API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/weather/globe returns cities payload', async () => {
    jest.spyOn(api, 'getGlobeWeather').mockResolvedValue({
      cities: [
        {
          id: 'london',
          name: 'London',
          country: 'UK',
          lat: 51.5074,
          lon: -0.1278,
          temperature: 14,
          humidity: 70,
          windKph: 18,
          condition: 'Cloudy',
          iconUrl: '//cdn.weatherapi.com/icon.png',
        },
      ],
    });

    const response = await request(app).get('/api/weather/globe');
    expect(response.status).toBe(200);
    expect(response.body.cities).toHaveLength(1);
    expect(response.body.cities[0].name).toBe('London');
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
  const apiKey = process.env.CONTROL_API_KEY || 'change-me';

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
      ipv4: null,
      gateway: null,
      publicIp: null,
      rxBps: null,
      txBps: null,
      targets: [{ name: 'internet', latencyMs: 18 }],
      history: [],
      windowSamples: 12,
    });

    const response = await request(app).get('/api/network/stats');
    expect(response.status).toBe(200);
    expect(response.body.online).toBe(true);
    expect(response.body.latencyMs).toBe(18);
    expect(response.body.targets).toHaveLength(1);
  });

  test('GET /api/network/summary requires auth', async () => {
    const response = await request(app).get('/api/network/summary');
    expect(response.status).toBe(401);
  });

  test('GET /api/network/summary returns payload with valid key', async () => {
    jest.spyOn(networkStats, 'getNetworkSummary').mockResolvedValue({
      online: true,
      latencyMs: 18,
      checkedAt: '2026-07-14T12:00:00.000Z',
      lastOnlineAt: '2026-07-14T12:00:00.000Z',
      interface: 'eth0',
      ipv4: '192.168.1.50',
      gateway: '192.168.1.1',
      publicIp: '203.0.113.10',
      rxBps: 1000,
      txBps: 200,
      targets: [{ name: 'internet', latencyMs: 18 }],
      history: [{ at: '2026-07-14T12:00:00.000Z', rxBps: 1000, txBps: 200, latencyMs: 18 }],
      windowSamples: 12,
      available: true,
    });

    const response = await request(app)
      .get('/api/network/summary')
      .set('x-api-key', apiKey);

    expect(response.status).toBe(200);
    expect(response.body.available).toBe(true);
    expect(response.body.publicIp).toBe('203.0.113.10');
    expect(response.body.targets).toHaveLength(1);
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

describe('Formula 1 API', () => {
  const CHAMPIONSHIP = {
    season: '2026',
    round: 11,
    drivers: [
      {
        position: 1,
        driverId: 'antonelli',
        code: 'ANT',
        givenName: 'Andrea Kimi',
        familyName: 'Antonelli',
        constructor: 'Mercedes',
        points: 219,
        wins: 6,
      },
    ],
    constructors: [
      { position: 1, constructorId: 'mercedes', name: 'Mercedes', points: 379, wins: 7 },
    ],
    nextRace: {
      round: 12,
      raceName: 'Dutch Grand Prix',
      circuitId: 'zandvoort',
      circuitName: 'Circuit Park Zandvoort',
      locality: 'Zandvoort',
      country: 'Netherlands',
      startsAt: '2026-08-23T13:00:00.000Z',
      qualifying: '2026-08-22T14:00:00.000Z',
      sprint: null,
    },
    fetchedAt: '2026-07-26T12:00:00.000Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/f1/standings returns championships with an idle live block', async () => {
    jest.spyOn(f1Standings, 'getChampionships').mockResolvedValue(CHAMPIONSHIP);
    jest.spyOn(f1Live, 'getLiveSnapshot').mockReturnValue({ active: false, order: [] });

    const response = await request(app).get('/api/f1/standings');
    expect(response.status).toBe(200);
    expect(response.body.season).toBe('2026');
    expect(response.body.drivers[0].code).toBe('ANT');
    expect(response.body.constructors[0].name).toBe('Mercedes');
    expect(response.body.live.active).toBe(false);
    expect(response.body.nextRace).toMatchObject({
      raceName: 'Dutch Grand Prix',
      locality: 'Zandvoort',
      startsAt: '2026-08-23T13:00:00.000Z',
    });
  });

  test('GET /api/f1/standings includes live race order during a session', async () => {
    jest.spyOn(f1Standings, 'getChampionships').mockResolvedValue(CHAMPIONSHIP);
    jest.spyOn(f1Live, 'getLiveSnapshot').mockReturnValue({
      active: true,
      sessionName: 'Race',
      meetingName: 'British Grand Prix',
      trackStatus: 'Green',
      trackStatusCode: 1,
      lap: 23,
      totalLaps: 52,
      order: [{ position: 1, number: 44, code: 'HAM', gapToLeader: '', interval: null }],
    });

    const response = await request(app).get('/api/f1/standings');
    expect(response.status).toBe(200);
    expect(response.body.live.active).toBe(true);
    expect(response.body.live.lap).toBe(23);
    expect(response.body.live.order[0].code).toBe('HAM');
  });

  test('GET /api/f1/standings returns 502 when the upstream fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(f1Standings, 'getChampionships').mockRejectedValue(new Error('jolpica down'));

    const response = await request(app).get('/api/f1/standings');
    expect(response.status).toBe(502);
    expect(response.body.error).toMatch(/F1 standings/i);
  });
});

describe('Formula 1 constructor logos', () => {
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

  function mockLogoResponse({ ok = true, status = 200 } = {}) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok,
      status,
      arrayBuffer: async () => PNG,
      headers: new Map([['content-type', 'image/webp']]),
    });
  }

  beforeEach(() => {
    f1Logos.resetLogoCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/f1/logo/:id serves the image with a long cache window', async () => {
    mockLogoResponse();

    const response = await request(app).get('/api/f1/logo/mercedes');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/webp/);
    expect(response.headers['cache-control']).toMatch(/max-age=604800/);
    expect(response.body).toEqual(PNG);
  });

  test('serves a repeat request from cache without refetching', async () => {
    const fetchSpy = mockLogoResponse();

    await request(app).get('/api/f1/logo/ferrari');
    await request(app).get('/api/f1/logo/ferrari');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('maps constructor ids that differ from F1 slugs', async () => {
    const fetchSpy = mockLogoResponse();

    await request(app).get('/api/f1/logo/red_bull');

    expect(fetchSpy.mock.calls[0][0]).toContain('redbullracing');
  });

  test('returns 404 when the upstream has no logo', async () => {
    mockLogoResponse({ ok: false, status: 404 });

    const response = await request(app).get('/api/f1/logo/not-a-team');
    expect(response.status).toBe(404);
  });
});

describe('Formula 1 circuit maps and flags', () => {
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

  function mockImageResponse({ ok = true, status = 200 } = {}) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok,
      status,
      arrayBuffer: async () => PNG,
      headers: new Map([['content-type', 'image/png']]),
    });
  }

  beforeEach(() => {
    f1Media.resetMediaCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/f1/circuit/:id serves the track map', async () => {
    const fetchSpy = mockImageResponse();

    const response = await request(app).get('/api/f1/circuit/zandvoort');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/png/);
    expect(response.headers['cache-control']).toMatch(/max-age=604800/);
    expect(fetchSpy.mock.calls[0][0]).toContain('Netherlands_Circuit.png');
  });

  test('GET /api/f1/flag/:country serves the country flag', async () => {
    const fetchSpy = mockImageResponse();

    const response = await request(app).get('/api/f1/flag/Netherlands');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/png/);
    expect(fetchSpy.mock.calls[0][0]).toContain('flagcdn.com/w40/nl.png');
  });

  test('caches circuit maps on a second hit', async () => {
    const fetchSpy = mockImageResponse();

    await request(app).get('/api/f1/circuit/silverstone');
    await request(app).get('/api/f1/circuit/silverstone');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('returns 404 for an unknown circuit or country', async () => {
    const response = await request(app).get('/api/f1/circuit/not_a_track');
    expect(response.status).toBe(404);

    const flag = await request(app).get('/api/f1/flag/Narnia');
    expect(flag.status).toBe(404);
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

describe('Analytics API', () => {
  const apiKey = process.env.CONTROL_API_KEY || 'change-me';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/analytics/summary requires auth', async () => {
    const response = await request(app).get('/api/analytics/summary');
    expect(response.status).toBe(401);
  });

  test('GET /api/analytics/summary returns payload with valid key', async () => {
    jest.spyOn(metrics, 'getSummary').mockResolvedValue({
      mostViewedWidget: { key: 'spotify', views: 4 },
      busiestHour: { hour: 18, events: 12 },
      slowestApi: { path: '/api/stocks', avgMs: 500, samples: 2 },
      windowHours: 24,
      totals: { apiCalls: 20, widgetViews: 4 },
      available: true,
    });

    const response = await request(app)
      .get('/api/analytics/summary')
      .set('x-api-key', apiKey);

    expect(response.status).toBe(200);
    expect(response.body.mostViewedWidget.key).toBe('spotify');
    expect(response.body.available).toBe(true);
  });

  test('POST /api/analytics/event accepts widget_view', async () => {
    const spy = jest.spyOn(metrics, 'record').mockImplementation(() => {});
    const response = await request(app)
      .post('/api/analytics/event')
      .send({ type: 'widget_view', widget: 'news', source: 'auto' });

    expect(response.status).toBe(202);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'widget_view', widget_key: 'news', source: 'auto' })
    );
  });

  test('POST /api/analytics/event rejects invalid type', async () => {
    const response = await request(app)
      .post('/api/analytics/event')
      .send({ type: 'api', widget: 'news' });
    expect(response.status).toBe(400);
  });
});
