const express = require('express');
const api = require('../services/api');
const metrics = require('../services/metrics');

function requireAuth(req, res, next) {
  if (!api.verifyControlKey(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function createAnalyticsRouter() {
  const router = express.Router();

  router.get('/summary', requireAuth, async (_req, res) => {
    const summary = await metrics.getSummary();
    res.json(summary);
  });

  router.post('/event', (req, res) => {
    const type = req.body?.type;
    if (type !== 'widget_view') {
      return res.status(400).json({ error: 'type must be widget_view' });
    }

    const widget = String(req.body?.widget || req.body?.widget_key || '').trim();
    if (!widget) {
      return res.status(400).json({ error: 'widget is required' });
    }

    const source = String(req.body?.source || 'auto').trim() || 'auto';
    metrics.record({
      type: 'widget_view',
      widget_key: widget,
      source,
    });
    res.status(202).json({ ok: true });
  });

  return router;
}

module.exports = createAnalyticsRouter;
