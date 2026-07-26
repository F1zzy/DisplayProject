require('dotenv').config();

const WebSocket = require('ws');

const f1Token = require('./f1Token');
const f1Logos = require('./f1Logos');

/**
 * Client for the (unofficial) F1 live timing feed.
 *
 * F1 moved this from legacy ASP.NET SignalR to SignalR Core, which normally
 * expects a Bearer JWT from an F1 account. We attempt an anonymous connection
 * and use a stored token when one is available; either way a failure only means
 * the widget falls back to championship standings.
 */

const NEGOTIATE_URL = 'https://livetiming.formula1.com/signalrcore/negotiate';
const CONNECT_URL = 'wss://livetiming.formula1.com/signalrcore';
const STATUS_URL = 'https://livetiming.formula1.com/static/StreamingStatus.json';

const TOPICS = [
  'SessionInfo',
  'SessionStatus',
  'TrackStatus',
  'LapCount',
  'DriverList',
  'TimingData',
  // Carries GridPos, which gives places gained or lost since the start.
  'TimingAppData',
];

/** SignalR Core delimits messages with the ASCII record separator. */
const RS = '\u001e';

const STATUS_POLL_MS = 60 * 1000;
const OFFLINE_GRACE_MS = 5 * 60 * 1000;
const PING_MS = 30 * 1000;
const RECONNECT_MIN_MS = 5000;
const RECONNECT_MAX_MS = 60000;
const REQUEST_TIMEOUT_MS = 10000;

const TRACK_STATUS_LABELS = {
  1: 'Green',
  2: 'Yellow',
  3: 'Yellow',
  4: 'Safety Car',
  5: 'Red',
  6: 'Virtual Safety Car',
  7: 'VSC Ending',
};

const state = {
  feed: {},
  streaming: false,
  connected: false,
  lastMessageAt: null,
  lastError: null,
};

let statusTimer = null;
let reconnectTimer = null;
let offlineTimer = null;
let pingTimer = null;
let socket = null;
let reconnectDelay = RECONNECT_MIN_MS;
let running = false;
let errorLogged = false;

function isEnabled() {
  return process.env.F1_LIVE_ENABLED !== 'false';
}

function unref(timer) {
  if (timer && typeof timer.unref === 'function') timer.unref();
  return timer;
}

function logOnce(message) {
  if (errorLogged) return;
  errorLogged = true;
  console.error('F1 live timing:', message);
}

/**
 * Recursively merge a feed delta into accumulated state.
 * Objects merge key-by-key; everything else replaces.
 */
function mergeState(target, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch;
  }

  const base = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  const next = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      next[key] = mergeState(base[key], value);
    } else {
      next[key] = value;
    }
  }

  return next;
}

/** The static status file is served with a UTF-8 BOM. */
function parseStreamingStatus(text) {
  if (typeof text !== 'string') return false;
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return false;

  try {
    const parsed = JSON.parse(cleaned);
    const status = String(parsed?.Status || '').toLowerCase();
    return Boolean(status) && status !== 'offline';
  } catch {
    return false;
  }
}

/** Split a raw socket chunk into complete SignalR Core frames. */
function parseFrames(buffer) {
  const parts = String(buffer).split(RS);
  const remainder = parts.pop() ?? '';
  const messages = [];

  for (const part of parts) {
    if (!part) continue;
    try {
      messages.push(JSON.parse(part));
    } catch {
      // Ignore malformed frames rather than tearing down the connection.
    }
  }

  return { messages, remainder };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Project accumulated feed topics into the shape the widget consumes. */
function buildSnapshot(feed, { connected = false } = {}) {
  const sessionInfo = feed?.SessionInfo || {};
  const sessionStatus = feed?.SessionStatus || {};
  const trackStatus = feed?.TrackStatus || {};
  const lapCount = feed?.LapCount || {};
  const driverList = feed?.DriverList || {};
  const lines = feed?.TimingData?.Lines || {};
  const appLines = feed?.TimingAppData?.Lines || {};

  const order = Object.entries(lines)
    .map(([number, line]) => {
      const driver = driverList[number] || {};
      const position = toNumber(line?.Position);
      const interval = line?.IntervalToPositionAhead?.Value ?? null;
      // GridPos is 0 for a pit-lane start, which is not a real grid slot.
      const gridPosition = toNumber(appLines[number]?.GridPos) || null;
      return {
        position,
        number: toNumber(number),
        code: driver.Tla || null,
        name: driver.FullName || driver.BroadcastName || null,
        team: driver.TeamName || null,
        constructorId: f1Logos.resolveConstructorId(driver.TeamName),
        teamColour: driver.TeamColour ? `#${String(driver.TeamColour).replace(/^#/, '')}` : null,
        gapToLeader: line?.GapToLeader ?? null,
        interval: interval || null,
        inPit: Boolean(line?.InPit),
        retired: Boolean(line?.Retired || line?.Stopped),
        gridPosition,
        positionChange: gridPosition != null && position != null ? gridPosition - position : null,
      };
    })
    .filter((entry) => entry.position != null)
    .sort((a, b) => a.position - b.position);

  const statusText = String(sessionStatus?.Status || '');
  const finished = /finalised|finished|ends/i.test(statusText);
  const trackCode = toNumber(trackStatus?.Status);

  return {
    active: connected && order.length > 0 && !finished,
    sessionName: sessionInfo?.Name || sessionInfo?.Type || null,
    meetingName: sessionInfo?.Meeting?.Name || null,
    sessionStatus: statusText || null,
    trackStatus: trackCode ? TRACK_STATUS_LABELS[trackCode] || null : null,
    trackStatusCode: trackCode,
    lap: toNumber(lapCount?.CurrentLap),
    totalLaps: toNumber(lapCount?.TotalLaps),
    order,
  };
}

function emptySnapshot() {
  return {
    active: false,
    sessionName: null,
    meetingName: null,
    sessionStatus: null,
    trackStatus: null,
    trackStatusCode: null,
    lap: null,
    totalLaps: null,
    order: [],
  };
}

function getLiveSnapshot() {
  if (!isEnabled() || !state.streaming) return emptySnapshot();
  return buildSnapshot(state.feed, { connected: state.connected });
}

function applyFeedMessage(topic, data) {
  if (!topic || !TOPICS.includes(topic)) return;
  state.feed[topic] = mergeState(state.feed[topic], data);
  state.lastMessageAt = Date.now();
}

function applySnapshotResult(result) {
  if (!result || typeof result !== 'object') return;
  for (const [topic, data] of Object.entries(result)) {
    if (!TOPICS.includes(topic)) continue;
    state.feed[topic] = mergeState(state.feed[topic], data);
  }
  state.lastMessageAt = Date.now();
}

function handleMessage(message) {
  if (!message || typeof message !== 'object') return;

  // type 1 = invocation (live push), type 3 = completion (initial full snapshot)
  if (message.type === 1 && message.target === 'feed') {
    const [topic, data] = message.arguments || [];
    applyFeedMessage(topic, data);
    return;
  }

  if (message.type === 3) {
    applySnapshotResult(message.result);
  }
}

async function negotiate() {
  // Resolved per attempt so a token refreshed on disk applies without a restart.
  const token = f1Token.getToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Pre-flight to pick up the AWS load balancer sticky-session cookie.
  const preflight = await fetch(NEGOTIATE_URL, {
    method: 'OPTIONS',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const setCookie =
    typeof preflight.headers.getSetCookie === 'function'
      ? preflight.headers.getSetCookie()
      : [preflight.headers.get('set-cookie')].filter(Boolean);

  const cookie = setCookie
    .map((entry) => String(entry).split(';')[0])
    .filter((entry) => entry.startsWith('AWSALBCORS'))
    .join('; ');

  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${NEGOTIATE_URL}?negotiateVersion=1`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`negotiate failed (${response.status})`);
  }

  const payload = await response.json();
  const id = payload?.connectionToken || payload?.connectionId;
  if (!id) throw new Error('negotiate response missing connection id');

  return { id, cookie, token };
}

function scheduleReconnect() {
  if (!running || reconnectTimer) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  reconnectTimer = unref(
    setTimeout(() => {
      reconnectTimer = null;
      if (running && state.streaming) connect();
    }, delay)
  );
}

function teardownSocket() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (socket) {
    socket.removeAllListeners();
    try {
      socket.close();
    } catch {
      // Already closing.
    }
    socket = null;
  }
  state.connected = false;
}

async function connect() {
  if (!running || socket) return;

  let negotiated;
  try {
    negotiated = await negotiate();
  } catch (error) {
    state.lastError = error.message || String(error);
    logOnce(state.lastError);
    scheduleReconnect();
    return;
  }

  const params = new URLSearchParams({ id: negotiated.id });
  if (negotiated.token) params.set('access_token', negotiated.token);

  const headers = { 'User-Agent': 'BestHTTP', 'Accept-Encoding': 'gzip,identity' };
  if (negotiated.cookie) headers.Cookie = negotiated.cookie;

  const ws = new WebSocket(`${CONNECT_URL}?${params.toString()}`, { headers });
  socket = ws;

  let buffer = '';

  ws.on('open', () => {
    ws.send(`${JSON.stringify({ protocol: 'json', version: 1 })}${RS}`);
    ws.send(
      `${JSON.stringify({
        type: 1,
        invocationId: '0',
        target: 'Subscribe',
        arguments: [TOPICS],
      })}${RS}`
    );

    state.connected = true;
    state.lastError = null;
    reconnectDelay = RECONNECT_MIN_MS;
    errorLogged = false;

    pingTimer = unref(
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`${JSON.stringify({ type: 6 })}${RS}`);
        }
      }, PING_MS)
    );
  });

  ws.on('message', (raw) => {
    buffer += raw.toString();
    const { messages, remainder } = parseFrames(buffer);
    buffer = remainder;
    messages.forEach(handleMessage);
  });

  ws.on('error', (error) => {
    state.lastError = error.message || String(error);
    logOnce(state.lastError);
  });

  ws.on('close', () => {
    teardownSocket();
    scheduleReconnect();
  });
}

function disconnect() {
  teardownSocket();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectDelay = RECONNECT_MIN_MS;
}

function clearFeed() {
  state.feed = {};
  state.lastMessageAt = null;
}

async function pollStreamingStatus() {
  let live = false;
  try {
    const response = await fetch(STATUS_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
      live = parseStreamingStatus(await response.text());
    }
  } catch (error) {
    state.lastError = error.message || String(error);
    return;
  }

  if (live) {
    if (offlineTimer) {
      clearTimeout(offlineTimer);
      offlineTimer = null;
    }
    if (!state.streaming) {
      state.streaming = true;
      errorLogged = false;
    }
    if (!socket) connect();
    return;
  }

  if (state.streaming && !offlineTimer) {
    // Hold the last classification briefly after the feed drops.
    offlineTimer = unref(
      setTimeout(() => {
        offlineTimer = null;
        state.streaming = false;
        disconnect();
        clearFeed();
      }, OFFLINE_GRACE_MS)
    );
  }
}

function start() {
  if (running || !isEnabled()) return;
  running = true;
  pollStreamingStatus();
  statusTimer = unref(setInterval(pollStreamingStatus, STATUS_POLL_MS));
}

function stop() {
  running = false;
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  if (offlineTimer) {
    clearTimeout(offlineTimer);
    offlineTimer = null;
  }
  disconnect();
  clearFeed();
  state.streaming = false;
}

module.exports = {
  start,
  stop,
  getLiveSnapshot,
  isEnabled,
  // Exported for unit tests
  mergeState,
  parseStreamingStatus,
  parseFrames,
  buildSnapshot,
};
