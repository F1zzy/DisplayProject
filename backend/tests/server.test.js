const request = require('supertest');
const { app } = require('../server');

describe('API routes', () => {
  test('GET /api/health returns ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
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
