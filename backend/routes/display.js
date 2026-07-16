const express = require('express');
const api = require('../services/api');
const settings = require('../services/settings');
const { setDisplayPower } = require('../services/displayPower');

function createDisplayRouter(broadcast) {
  const router = express.Router();

  let displayState = {
    power: 'on',
    currentWidget: 0,
    pinned: false,
  };

  function requireAuth(req, res, next) {
    if (!api.verifyControlKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  function getWidgetCount() {
    return Math.max(1, settings.getSettings().enabledWidgets.length);
  }

  function getLiveState() {
    const widgetCount = getWidgetCount();
    const currentWidget = ((displayState.currentWidget % widgetCount) + widgetCount) % widgetCount;
    displayState = { ...displayState, currentWidget };
    return {
      power: displayState.power,
      currentWidget,
      widgetCount,
      pinned: Boolean(displayState.pinned),
    };
  }

  router.get('/state', (_req, res) => {
    res.json(getLiveState());
  });

  router.post('/auth/verify', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  router.post('/power', requireAuth, (req, res) => {
    const { action } = req.body;
    if (!['on', 'off', 'sleep'].includes(action)) {
      return res.status(400).json({ error: 'action must be on, off, or sleep' });
    }

    displayState = { ...displayState, power: action };
    broadcast({ type: 'display:power', action });
    setDisplayPower(action);
    res.json(getLiveState());
  });

  router.post('/widgets/rotate', requireAuth, (req, res) => {
    const widgetCount = getWidgetCount();
    const current = getLiveState().currentWidget;
    displayState = {
      ...displayState,
      pinned: false,
      currentWidget: (current + 1) % widgetCount,
    };
    const live = getLiveState();
    broadcast({ type: 'widgets:rotate', currentWidget: live.currentWidget, pinned: false });
    res.json(live);
  });

  router.post('/widgets/set', requireAuth, (req, res) => {
    const widgetCount = getWidgetCount();
    const index = parseInt(req.body.index, 10);
    if (Number.isNaN(index) || index < 0 || index >= widgetCount) {
      return res.status(400).json({ error: 'Invalid widget index' });
    }

    displayState = { ...displayState, currentWidget: index };
    const live = getLiveState();
    broadcast({ type: 'widgets:set', currentWidget: index, pinned: live.pinned });
    res.json(live);
  });

  router.post('/widgets/pin', requireAuth, (req, res) => {
    const pinned = Boolean(req.body?.pinned);
    const widgetCount = getWidgetCount();
    const nextState = { ...displayState, pinned };

    if (pinned && req.body?.index !== undefined && req.body?.index !== null && req.body?.index !== '') {
      const index = parseInt(req.body.index, 10);
      if (Number.isNaN(index) || index < 0 || index >= widgetCount) {
        return res.status(400).json({ error: 'Invalid widget index' });
      }
      nextState.currentWidget = index;
    }

    displayState = nextState;
    const live = getLiveState();
    broadcast({
      type: 'widgets:pin',
      pinned: live.pinned,
      currentWidget: live.currentWidget,
    });
    res.json(live);
  });

  // Legacy endpoint kept for compatibility
  router.post('/control-display', requireAuth, (req, res) => {
    const { action } = req.body;
    if (action === 'on' || action === 'off') {
      displayState = { ...displayState, power: action };
      broadcast({ type: 'display:power', action });
      setDisplayPower(action);
    }
    res.sendStatus(200);
  });

  return router;
}

module.exports = createDisplayRouter;
