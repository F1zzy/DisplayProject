const express = require('express');
const api = require('../services/api');
const settings = require('../services/settings');
const { setDisplayBrightness } = require('../services/displayBrightness');
const presence = require('../services/presence');

function createSettingsRouter(broadcast) {
  const router = express.Router();

  function requireAuth(req, res, next) {
    if (!api.verifyControlKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  router.get('/', (_req, res) => {
    res.json(settings.getSettings());
  });

  router.put('/', requireAuth, (req, res) => {
    try {
      const updated = settings.updateSettings(req.body || {});
      setDisplayBrightness(updated.displayBrightness);
      presence.reload();
      broadcast({ type: 'settings:update', settings: updated });
      res.json(updated);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to update settings' });
    }
  });

  return router;
}

module.exports = createSettingsRouter;
