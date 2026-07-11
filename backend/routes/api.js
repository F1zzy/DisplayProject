const express = require('express');
const api = require('../services/api');

const router = express.Router();

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
    const days = Math.min(parseInt(req.query.days, 10) || 7, 7);
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
    const symbols = (req.query.symbols || 'AAPL,GOOGL,MSFT')
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

module.exports = router;
