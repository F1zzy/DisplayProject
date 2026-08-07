const DEFAULT_URL = 'http://127.0.0.1:3010';
const TIMEOUT_MS = 800;

const EMPTY_SUMMARY = {
  mostViewedWidget: null,
  busiestHour: null,
  slowestApi: null,
  widgetViews: [],
  eventsByHour: [],
  apiLatency: [],
  windowHours: 24,
  totals: { apiCalls: 0, widgetViews: 0 },
};

function getBaseUrl() {
  const raw = process.env.ANALYTICS_URL;
  if (raw === 'false' || raw === '0' || raw === 'off') {
    return null;
  }
  // Keep unit/e2e tests offline unless ANALYTICS_URL is set explicitly.
  if ((raw === undefined || raw === '') && process.env.NODE_ENV === 'test') {
    return null;
  }
  if (raw === undefined || raw === '') {
    return DEFAULT_URL;
  }
  return String(raw).replace(/\/$/, '');
}

async function postJSON(path, body) {
  const base = getBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getJSON(path) {
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
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function record(event) {
  if (!event || typeof event !== 'object') return;
  void postJSON('/metrics', event);
}

function recordMany(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  void postJSON('/metrics', { events });
}

async function getSummary() {
  const data = await getJSON('/summary');
  if (!data || typeof data !== 'object') {
    return { ...EMPTY_SUMMARY, available: false };
  }
  return { ...EMPTY_SUMMARY, ...data, available: true };
}

function emptySummary() {
  return { ...EMPTY_SUMMARY, available: false };
}

function isEnabled() {
  return Boolean(getBaseUrl());
}

module.exports = {
  record,
  recordMany,
  getSummary,
  emptySummary,
  isEnabled,
  getBaseUrl,
  EMPTY_SUMMARY,
};
