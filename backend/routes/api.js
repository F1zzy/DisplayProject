const express = require('express');
const api = require('../services/api');
const calendar = require('../services/calendar');
const networkStats = require('../services/networkStats');
const sky = require('../services/sky');
const spotify = require('../services/spotify');
const settings = require('../services/settings');
const cache = require('../services/cache');

const router = express.Router();

const SPOTIFY_TTL_MS = 15000;

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

router.get('/weather/current', async (req, res) => {
  try {
    const location = api.getLocation(req);
    const data = await api.getCurrentWeather(location);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch current weather' });
  }
});

router.get('/weather/forecast', async (req, res) => {
  try {
    const location = api.getLocation(req);
    const defaultDays = settings.getSettings().forecastDays;
    const days = Math.min(parseInt(req.query.days, 10) || defaultDays, 7);
    const data = await api.getForecast(location, days);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch forecast' });
  }
});

router.get('/weather/hourly', async (req, res) => {
  try {
    const location = api.getLocation(req);
    const data = await api.getHourlyForecast(location);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch hourly forecast' });
  }
});

router.get('/stocks/:symbol', async (req, res) => {
  try {
    const data = await api.getStock(req.params.symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch stock data' });
  }
});

router.get('/stocks', async (req, res) => {
  try {
    const defaultSymbols = settings.getSettings().stockSymbols.join(',');
    const symbols = (req.query.symbols || defaultSymbols)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const data = await api.getStocksSequential(symbols);
    res.json({ symbols, data });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch stocks' });
  }
});

router.get('/news', async (req, res) => {
  try {
    const category = req.query.category === 'technology' ? 'technology' : 'general';
    const articles = await api.getNews(category);
    res.json(articles);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch news' });
  }
});

router.get('/calendar/events', async (req, res) => {
  try {
    if (!calendar.isConfigured()) {
      return res.status(503).json({
        error: 'Google Calendar is not configured',
        configured: false,
        events: [],
      });
    }

    const defaultDays = settings.getSettings().calendarDays;
    const days = Math.min(parseInt(req.query.days, 10) || defaultDays, 7);
    const events = await calendar.getUpcomingEvents({ days });
    res.json({ configured: true, events });
  } catch (error) {
    console.error(error);
    if (error.code === 'CALENDAR_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Google Calendar is not configured',
        configured: false,
        events: [],
      });
    }
    res.status(502).json({ error: 'Failed to fetch calendar events', events: [] });
  }
});

router.get('/network/stats', async (_req, res) => {
  try {
    const stats = await networkStats.getNetworkStats();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch network stats' });
  }
});

router.get('/sky/current', async (req, res) => {
  try {
    const location = api.getLocation(req);
    const data = await sky.getNightSky(location);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to fetch night sky' });
  }
});

router.get('/spotify/now', async (_req, res) => {
  try {
    if (!spotify.isConfigured()) {
      return res.status(503).json({
        error: 'Spotify is not configured',
        configured: false,
        track: null,
        topTracks: [],
        playing: false,
      });
    }

    const cacheKey = 'spotify:now';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const data = await spotify.getNowPlayingPayload();
    cache.set(cacheKey, data, SPOTIFY_TTL_MS);
    res.json(data);
  } catch (error) {
    console.error(error);
    if (error.status === 503 || error.configured === false) {
      return res.status(503).json({
        error: 'Spotify is not configured',
        configured: false,
        track: null,
        topTracks: [],
        playing: false,
      });
    }
    res.status(502).json({
      error: 'Failed to fetch Spotify data',
      configured: true,
      track: null,
      topTracks: [],
      playing: false,
    });
  }
});

module.exports = router;
