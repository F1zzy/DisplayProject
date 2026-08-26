const settings = require('./settings');
const metrics = require('./metrics');
const { setDisplayPower } = require('./displayPower');

const VALID_POWER = new Set(['on', 'off', 'sleep']);

let broadcast = () => {};
let state = {
  power: 'on',
  currentWidget: 0,
  pinned: false,
};

function configure(options = {}) {
  if (typeof options.broadcast === 'function') {
    broadcast = options.broadcast;
  }
}

function resetState() {
  state = {
    power: 'on',
    currentWidget: 0,
    pinned: false,
  };
}

function getWidgetCount() {
  return Math.max(1, settings.getSettings().enabledWidgets.length);
}

function widgetKeyAt(index) {
  const enabled = settings.getSettings().enabledWidgets || [];
  return enabled[index] || null;
}

function recordWidgetView(index, source) {
  const key = widgetKeyAt(index);
  if (!key) return;
  metrics.record({
    type: 'widget_view',
    widget_key: key,
    source,
  });
}

function normalizeWidgetIndex(index) {
  const widgetCount = getWidgetCount();
  return ((index % widgetCount) + widgetCount) % widgetCount;
}

function getLiveState() {
  const widgetCount = getWidgetCount();
  const currentWidget = normalizeWidgetIndex(state.currentWidget);
  if (currentWidget !== state.currentWidget) {
    state = { ...state, currentWidget };
  }
  return {
    power: state.power,
    currentWidget,
    widgetCount,
    pinned: Boolean(state.pinned),
  };
}

function getPower() {
  return state.power;
}

/**
 * @param {'on'|'off'|'sleep'} action
 * @param {{ source?: string }} [options]
 * @returns {{ ok: boolean, error?: string, changed?: boolean, state: object }}
 */
function applyPower(action, options = {}) {
  if (!VALID_POWER.has(action)) {
    return { ok: false, error: 'action must be on, off, or sleep', state: getLiveState() };
  }

  const source = options.source || 'manual';
  if (source === 'presence') {
    if (action === 'off' || state.power === 'off' || state.power === action) {
      return { ok: true, changed: false, state: getLiveState() };
    }
  }

  const changed = state.power !== action;
  state = { ...state, power: action };
  if (changed) {
    broadcast({ type: 'display:power', action });
    setDisplayPower(action);
    metrics.record({ type: 'power', power_action: action });
  }
  return { ok: true, changed, state: getLiveState() };
}

function rotateWidget() {
  const widgetCount = getWidgetCount();
  const current = getLiveState().currentWidget;
  state = {
    ...state,
    pinned: false,
    currentWidget: (current + 1) % widgetCount,
  };
  const live = getLiveState();
  broadcast({ type: 'widgets:rotate', currentWidget: live.currentWidget, pinned: false });
  recordWidgetView(live.currentWidget, 'rotate');
  return live;
}

function setWidget(index) {
  const widgetCount = getWidgetCount();
  const parsed = parseInt(index, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed >= widgetCount) {
    return { ok: false, error: 'Invalid widget index', state: getLiveState() };
  }
  state = { ...state, currentWidget: parsed };
  const live = getLiveState();
  broadcast({ type: 'widgets:set', currentWidget: parsed, pinned: live.pinned });
  recordWidgetView(live.currentWidget, 'set');
  return { ok: true, state: live };
}

function pinWidget({ pinned, index } = {}) {
  const nextPinned = Boolean(pinned);
  const widgetCount = getWidgetCount();
  const nextState = { ...state, pinned: nextPinned };

  if (
    nextPinned &&
    index !== undefined &&
    index !== null &&
    index !== ''
  ) {
    const parsed = parseInt(index, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= widgetCount) {
      return { ok: false, error: 'Invalid widget index', state: getLiveState() };
    }
    nextState.currentWidget = parsed;
  }

  state = nextState;
  const live = getLiveState();
  broadcast({
    type: 'widgets:pin',
    pinned: live.pinned,
    currentWidget: live.currentWidget,
  });
  if (nextPinned) {
    recordWidgetView(live.currentWidget, 'pin');
  }
  return { ok: true, state: live };
}

module.exports = {
  configure,
  resetState,
  getLiveState,
  getPower,
  applyPower,
  rotateWidget,
  setWidget,
  pinWidget,
};
