const DEFAULT_URL = 'http://127.0.0.1:3011';
const TIMEOUT_MS = 2500;

const OFFLINE_STATS = {
  online: false,
  latencyMs: null,
  checkedAt: null,
  lastOnlineAt: null,
  interface: null,
  ipv4: null,
  gateway: null,
  publicIp: null,
  rxBps: null,
  txBps: null,
};

const OFFLINE_SUMMARY = {
  ...OFFLINE_STATS,
  targets: [],
  history: [],
  windowSamples: 0,
  available: false,
};

function getBaseUrl() {
  const raw = process.env.NETWORK_SERVICE_URL;
  if (raw === 'false' || raw === '0' || raw === 'off') {
    return null;
  }
  // Keep unit/e2e tests offline unless NETWORK_SERVICE_URL is set explicitly.
  if ((raw === undefined || raw === '') && process.env.NODE_ENV === 'test') {
    return null;
  }
  if (raw === undefined || raw === '') {
    return DEFAULT_URL;
  }
  return String(raw).replace(/\/$/, '');
}

async function fetchFromGo(path) {
  const base = getBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Network service unreachable:', error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function optionalNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function normalizeTargets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      name: optionalString(row?.name) || 'unknown',
      latencyMs: optionalNumber(row?.latencyMs),
    }))
    .filter((row) => row.name);
}

function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => ({
    at: optionalString(row?.at) || new Date().toISOString(),
    rxBps: optionalNumber(row?.rxBps),
    txBps: optionalNumber(row?.txBps),
    latencyMs: optionalNumber(row?.latencyMs),
  }));
}

function normalizeStats(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      ...OFFLINE_STATS,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    online: Boolean(raw.online),
    latencyMs: optionalNumber(raw.latencyMs),
    checkedAt: raw.checkedAt || new Date().toISOString(),
    lastOnlineAt: optionalString(raw.lastOnlineAt),
    interface: optionalString(raw.interface),
    ipv4: optionalString(raw.ipv4),
    gateway: optionalString(raw.gateway),
    publicIp: optionalString(raw.publicIp ?? raw.publicIP),
    rxBps: optionalNumber(raw.rxBps),
    txBps: optionalNumber(raw.txBps),
  };
}

function normalizeSummary(raw, { available = true } = {}) {
  if (!raw || typeof raw !== 'object') {
    return {
      ...OFFLINE_SUMMARY,
      checkedAt: new Date().toISOString(),
      available: false,
    };
  }

  const stats = normalizeStats(raw);
  return {
    ...stats,
    targets: normalizeTargets(raw.targets),
    history: normalizeHistory(raw.history),
    windowSamples: optionalNumber(raw.windowSamples) ?? 0,
    available: available && Boolean(getBaseUrl()),
  };
}

async function getNetworkStats() {
  // Prefer /summary so the kiosk widget gets targets + history.
  const summary = await fetchFromGo('/summary');
  if (summary) {
    const normalized = normalizeSummary(summary, { available: true });
    return {
      online: normalized.online,
      latencyMs: normalized.latencyMs,
      checkedAt: normalized.checkedAt,
      lastOnlineAt: normalized.lastOnlineAt,
      interface: normalized.interface,
      ipv4: normalized.ipv4,
      gateway: normalized.gateway,
      publicIp: normalized.publicIp,
      rxBps: normalized.rxBps,
      txBps: normalized.txBps,
      targets: normalized.targets,
      history: normalized.history,
      windowSamples: normalized.windowSamples,
    };
  }

  const remote = await fetchFromGo('/stats');
  if (remote) {
    const stats = normalizeStats(remote);
    return {
      ...stats,
      targets: [],
      history: [],
      windowSamples: 0,
    };
  }
  return {
    ...OFFLINE_STATS,
    checkedAt: new Date().toISOString(),
    targets: [],
    history: [],
    windowSamples: 0,
  };
}

async function getNetworkSummary() {
  if (!getBaseUrl()) {
    return {
      ...OFFLINE_SUMMARY,
      checkedAt: new Date().toISOString(),
      available: false,
    };
  }

  const remote = await fetchFromGo('/summary');
  if (remote) {
    return normalizeSummary(remote, { available: true });
  }
  return {
    ...OFFLINE_SUMMARY,
    checkedAt: new Date().toISOString(),
    available: false,
  };
}

function isEnabled() {
  return Boolean(getBaseUrl());
}

module.exports = {
  getNetworkStats,
  getNetworkSummary,
  normalizeStats,
  normalizeSummary,
  isEnabled,
  getBaseUrl,
  OFFLINE_STATS,
  OFFLINE_SUMMARY,
};
