const express = require('express');
const api = require('../services/api');

function createDisplayRouter(broadcast) {
  const router = express.Router();

  let displayState = {
    power: 'on',
    currentWidget: 0,
    widgetCount: 3,
  };

  function requireAuth(req, res, next) {
    if (!api.verifyControlKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  router.get('/state', (_req, res) => {
    res.json(displayState);
  });

  router.post('/power', requireAuth, (req, res) => {
    const { action } = req.body;
    if (!['on', 'off', 'sleep'].includes(action)) {
      return res.status(400).json({ error: 'action must be on, off, or sleep' });
    }

    displayState = { ...displayState, power: action };
    broadcast({ type: 'display:power', action });
    res.json(displayState);
  });

  router.post('/widgets/rotate', requireAuth, (req, res) => {
    displayState = {
      ...displayState,
      currentWidget: (displayState.currentWidget + 1) % displayState.widgetCount,
    };
    broadcast({ type: 'widgets:rotate', currentWidget: displayState.currentWidget });
    res.json(displayState);
  });

  router.post('/widgets/set', requireAuth, (req, res) => {
    const index = parseInt(req.body.index, 10);
    if (Number.isNaN(index) || index < 0 || index >= displayState.widgetCount) {
      return res.status(400).json({ error: 'Invalid widget index' });
    }

    displayState = { ...displayState, currentWidget: index };
    broadcast({ type: 'widgets:set', currentWidget: index });
    res.json(displayState);
  });

  // Legacy endpoint kept for compatibility
  router.post('/control-display', requireAuth, (req, res) => {
    const { action } = req.body;
    if (action === 'on' || action === 'off') {
      displayState = { ...displayState, power: action };
      broadcast({ type: 'display:power', action });
    }
    res.sendStatus(200);
  });

  return router;
}

module.exports = createDisplayRouter;
