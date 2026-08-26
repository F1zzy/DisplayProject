const settings = require('./settings');

const DEFAULT_URL = 'http://127.0.0.1:3012';
const TIMEOUT_MS = 2500;

let running = false;
let timer = null;
let inFlight = false;
let lastSnapshot = null;
let applyPowerFn = null;
let getPowerFn = null;
let fetchImpl = global.fetch;

function getBaseUrl() {
  const raw = process.env.PRESENCE_SERVICE_URL;
  if (raw === 'false' || raw === '0' || raw === 'off') {
    return null;
  }
  if ((raw === undefined || raw === '') && process.env.NODE_ENV === 'test') {
    return null;
  }
  if (raw === undefined || raw === '') {
    return DEFAULT_URL;
  }
  return String(raw).replace(/\/$/, '');
}

function normalizeStatus(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  let home = null;
  if (raw.home === true) home = true;
  else if (raw.home === false) home = false;
  return {
    enabled: Boolean(raw.enabled),
    host: typeof raw.host === 'string' ? raw.host : '',
    home,
    away: Boolean(raw.away),
  };
}

/**
 * Map Go status onto display power. Presence never sends off;
 * sticky off is skipped by the caller passing power === 'off'.
 */
function applyFromStatus({ home, away, power }) {
  if (power === 'off') {
    return null;
  }
  if (home === true && power === 'sleep') {
    return 'on';
  }
  if (away === true && power === 'on') {
    return 'sleep';
  }
  return null;
}

async function request(path, options = {}) {
  const base = getBaseUrl();
  if (!base || typeof fetchImpl !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${base}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Presence service unreachable:', error.message);
    return null;
  } finally {
    clearTimeout(timerId);
  }
}

async function putConfig() {
  const cfg = settings.getSettings();
  const raw = await request('/config', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: Boolean(cfg.presenceEnabled),
      host: cfg.presenceHost || '',
      intervalMs: cfg.presenceIntervalMs,
      awayAfterMs: cfg.presenceAwayAfterMs,
    }),
  });
  return normalizeStatus(raw);
}

async function fetchStatus() {
  return normalizeStatus(await request('/status'));
}

function getStatus() {
  const cfg = settings.getSettings();
  return {
    enabled: Boolean(cfg.presenceEnabled) && Boolean(cfg.presenceHost),
    home: lastSnapshot ? lastSnapshot.home : null,
    host: cfg.presenceHost || '',
  };
}

function maybeApply(snapshot) {
  if (!snapshot) return;
  lastSnapshot = snapshot;
  const power = getPowerFn ? getPowerFn() : 'on';
  const action = applyFromStatus({
    home: snapshot.home,
    away: snapshot.away,
    power,
  });
  if (action && applyPowerFn) {
    applyPowerFn(action, { source: 'presence' });
  }
}

async function tick() {
  if (inFlight) return;
  const cfg = settings.getSettings();
  if (!cfg.presenceEnabled || !cfg.presenceHost || !getBaseUrl()) {
    lastSnapshot = null;
    return;
  }

  inFlight = true;
  try {
    const snapshot = await fetchStatus();
    maybeApply(snapshot);
  } finally {
    inFlight = false;
  }
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule() {
  clearTimer();
  if (!running) return;
  const interval = Math.max(5000, settings.getSettings().presenceIntervalMs || 15000);
  timer = setTimeout(() => {
    tick()
      .catch((error) => {
        console.error('Presence poll failed:', error.message);
      })
      .finally(() => {
        schedule();
      });
  }, interval);
}

function configure(options = {}) {
  if (typeof options.applyPower === 'function') {
    applyPowerFn = options.applyPower;
  }
  if (typeof options.getPower === 'function') {
    getPowerFn = options.getPower;
  }
  if (typeof options.fetch === 'function') {
    fetchImpl = options.fetch;
  }
}

async function syncConfig() {
  const snapshot = await putConfig();
  maybeApply(snapshot);
}

function start(options = {}) {
  stop();
  configure(options);
  running = true;
  lastSnapshot = null;
  const cfg = settings.getSettings();
  if (getBaseUrl() && cfg.presenceEnabled && cfg.presenceHost) {
    schedule();
  }
  syncConfig().catch((error) => {
    console.error('Presence config sync failed:', error.message);
  });
}

function reload() {
  lastSnapshot = null;
  if (!running) return;
  if (!getBaseUrl()) {
    clearTimer();
    return;
  }
  const cfg = settings.getSettings();
  if (!cfg.presenceEnabled || !cfg.presenceHost) {
    clearTimer();
  } else {
    schedule();
  }
  syncConfig().catch((error) => {
    console.error('Presence config sync failed:', error.message);
  });
}

function stop() {
  running = false;
  inFlight = false;
  clearTimer();
}

function resetForTests() {
  stop();
  lastSnapshot = null;
  applyPowerFn = null;
  getPowerFn = null;
  fetchImpl = global.fetch;
}

module.exports = {
  start,
  stop,
  reload,
  tick,
  configure,
  getStatus,
  applyFromStatus,
  getBaseUrl,
  resetForTests,
};
