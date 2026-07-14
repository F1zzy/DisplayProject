const request = require('supertest');
const { app } = require('../server');
const calendar = require('../services/calendar');

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

describe('Display control', () => {
  const apiKey = process.env.CONTROL_API_KEY || 'display-control-secret-change-me';

  test('GET /api/display/state returns display state', async () => {
    const response = await request(app).get('/api/display/state');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('power');
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
});
