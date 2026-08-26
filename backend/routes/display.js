const express = require('express');
const api = require('../services/api');
const displayControl = require('../services/displayControl');
const presence = require('../services/presence');

function createDisplayRouter(broadcast) {
  displayControl.configure({ broadcast });
  const router = express.Router();

  function requireAuth(req, res, next) {
    if (!api.verifyControlKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  router.get('/state', (_req, res) => {
    res.json({
      ...displayControl.getLiveState(),
      presence: presence.getStatus(),
    });
  });

  router.post('/auth/verify', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  router.post('/power', requireAuth, (req, res) => {
    const result = displayControl.applyPower(req.body.action);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.state);
  });

  router.post('/widgets/rotate', requireAuth, (_req, res) => {
    res.json(displayControl.rotateWidget());
  });

  router.post('/widgets/set', requireAuth, (req, res) => {
    const result = displayControl.setWidget(req.body.index);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.state);
  });

  router.post('/widgets/pin', requireAuth, (req, res) => {
    const result = displayControl.pinWidget({
      pinned: req.body?.pinned,
      index: req.body?.index,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.state);
  });

  // Legacy endpoint kept for compatibility
  router.post('/control-display', requireAuth, (req, res) => {
    const { action } = req.body;
    if (action === 'on' || action === 'off') {
      displayControl.applyPower(action);
    }
    res.sendStatus(200);
  });

  return router;
}

module.exports = createDisplayRouter;
