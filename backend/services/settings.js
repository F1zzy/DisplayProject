const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
/** Override with DISPLAY_SETTINGS_PATH for isolated E2E / test runs. */
const SETTINGS_PATH = process.env.DISPLAY_SETTINGS_PATH
  ? path.resolve(process.env.DISPLAY_SETTINGS_PATH)
  : path.join(DATA_DIR, 'settings.json');

const VALID_WIDGETS = ['stock', 'news', 'timetable', 'network', 'sky', 'spotify', 'f1'];

const VALID_BACKGROUND_MODES = ['default', 'color', 'image'];

const VALID_COLOR_SCHEMES = ['orange-dark', 'cool-blue', 'soft-neutral', 'forest'];

const VALID_FONT_PRESETS = ['nothing', 'time-caps', 'system'];

const VALID_SECTIONS = ['header', 'weather', 'widgets'];

const VALID_CLOCK_SIDES = ['left', 'right'];

const VALID_DENSITIES = ['compact', 'comfortable', 'roomy'];

const VALID_CLOCK_ANIMATIONS = ['off', 'crossfade', 'flip'];

const VALID_NIGHT_FOCUS_WHEN = ['auto', 'always', 'custom'];

const DEFAULTS = {
  location: process.env.LOCATION || 'Nottingham',
  stockSymbols: ['AAPL', 'GOOGL', 'MSFT'],
  widgetRotationMs: 120000,
  enabledWidgets: [...VALID_WIDGETS],
  calendarDays: 1,
  newsGeneral: true,
  newsTechnology: true,
  forecastDays: 3,
  backgroundMode: 'default',
  backgroundColor: '#101115',
  backgroundImage: '',
  colorScheme: 'orange-dark',
  fontPreset: 'nothing',
  sectionOrder: [...VALID_SECTIONS],
  clockSide: 'left',
  density: 'comfortable',
  clockAnimation: 'off',
  weatherAtmosphere: false,
  nightFocusMode: false,
  nightFocusWhen: 'auto',
  nightFocusStartHour: 20,
  nightFocusEndHour: 6,
  displayBrightness: 100,
};

let cache = null;

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeSymbols(input) {
  const list = Array.isArray(input)
    ? input
    : String(input || '')
        .split(',')
        .map((s) => s.trim());

  return list
    .map((s) => String(s).toUpperCase().replace(/[^A-Z0-9.-]/g, ''))
    .filter(Boolean)
    .slice(0, 12);
}

function sanitizeEnabledWidgets(input) {
  if (!Array.isArray(input)) return [...DEFAULTS.enabledWidgets];
  const seen = new Set();
  const result = [];
  for (const id of input) {
    if (VALID_WIDGETS.includes(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result.length > 0 ? result : [...DEFAULTS.enabledWidgets];
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeBackgroundMode(value) {
  const mode = String(value || '').toLowerCase();
  return VALID_BACKGROUND_MODES.includes(mode) ? mode : DEFAULTS.backgroundMode;
}

function sanitizeBackgroundColor(value) {
  const color = String(value || '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
    return color.toLowerCase();
  }
  return DEFAULTS.backgroundColor;
}

function sanitizeBackgroundImage(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.length > 2048) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function sanitizeFromList(value, allowed, fallback) {
  const key = String(value || '').toLowerCase();
  return allowed.includes(key) ? key : fallback;
}

function sanitizeSectionOrder(input) {
  if (!Array.isArray(input)) return [...DEFAULTS.sectionOrder];
  const seen = new Set();
  const result = [];
  for (const id of input) {
    if (VALID_SECTIONS.includes(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result.length > 0 ? result : [...DEFAULTS.sectionOrder];
}

function normalize(partial = {}) {
  const merged = { ...DEFAULTS, ...partial };
  const symbols = sanitizeSymbols(merged.stockSymbols);

  return {
    location: String(merged.location || DEFAULTS.location).trim() || DEFAULTS.location,
    stockSymbols: symbols.length ? symbols : [...DEFAULTS.stockSymbols],
    widgetRotationMs: clampInt(merged.widgetRotationMs, 0, 3600000, DEFAULTS.widgetRotationMs),
    enabledWidgets: sanitizeEnabledWidgets(merged.enabledWidgets),
    calendarDays: clampInt(merged.calendarDays, 1, 7, DEFAULTS.calendarDays),
    newsGeneral: Boolean(merged.newsGeneral),
    newsTechnology: Boolean(merged.newsTechnology),
    forecastDays: clampInt(merged.forecastDays, 1, 7, DEFAULTS.forecastDays),
    backgroundMode: sanitizeBackgroundMode(merged.backgroundMode),
    backgroundColor: sanitizeBackgroundColor(merged.backgroundColor),
    backgroundImage: sanitizeBackgroundImage(merged.backgroundImage),
    colorScheme: sanitizeFromList(merged.colorScheme, VALID_COLOR_SCHEMES, DEFAULTS.colorScheme),
    fontPreset: sanitizeFromList(merged.fontPreset, VALID_FONT_PRESETS, DEFAULTS.fontPreset),
    sectionOrder: sanitizeSectionOrder(merged.sectionOrder),
    clockSide: sanitizeFromList(merged.clockSide, VALID_CLOCK_SIDES, DEFAULTS.clockSide),
    density: sanitizeFromList(merged.density, VALID_DENSITIES, DEFAULTS.density),
    clockAnimation: sanitizeFromList(
      merged.clockAnimation,
      VALID_CLOCK_ANIMATIONS,
      DEFAULTS.clockAnimation
    ),
    weatherAtmosphere: Boolean(merged.weatherAtmosphere),
    nightFocusMode: Boolean(merged.nightFocusMode),
    nightFocusWhen: sanitizeFromList(
      merged.nightFocusWhen,
      VALID_NIGHT_FOCUS_WHEN,
      DEFAULTS.nightFocusWhen
    ),
    nightFocusStartHour: clampInt(merged.nightFocusStartHour, 0, 23, DEFAULTS.nightFocusStartHour),
    nightFocusEndHour: clampInt(merged.nightFocusEndHour, 0, 23, DEFAULTS.nightFocusEndHour),
    displayBrightness: clampInt(merged.displayBrightness, 10, 100, DEFAULTS.displayBrightness),
  };
}

function readFromDisk() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return normalize();
    }
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    return normalize(raw);
  } catch (error) {
    console.error('Failed to read settings.json, using defaults:', error.message);
    return normalize();
  }
}

function writeToDisk(settings) {
  ensureDataDir();
  const tmpPath = `${SETTINGS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, SETTINGS_PATH);
}

function getSettings() {
  if (!cache) {
    cache = readFromDisk();
  }
  return {
    ...cache,
    stockSymbols: [...cache.stockSymbols],
    enabledWidgets: [...cache.enabledWidgets],
    sectionOrder: [...cache.sectionOrder],
  };
}

function updateSettings(partial) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    const error = new Error('Settings body must be an object');
    error.status = 400;
    throw error;
  }

  const allowed = new Set(Object.keys(DEFAULTS));
  const unknown = Object.keys(partial).filter((key) => !allowed.has(key));
  if (unknown.length) {
    const error = new Error(`Unknown settings keys: ${unknown.join(', ')}`);
    error.status = 400;
    throw error;
  }

  const next = normalize({ ...getSettings(), ...partial });
  writeToDisk(next);
  cache = next;
  return getSettings();
}

function resetSettingsCache() {
  cache = null;
}

module.exports = {
  VALID_WIDGETS,
  VALID_BACKGROUND_MODES,
  VALID_COLOR_SCHEMES,
  VALID_FONT_PRESETS,
  VALID_SECTIONS,
  VALID_CLOCK_SIDES,
  VALID_DENSITIES,
  VALID_CLOCK_ANIMATIONS,
  VALID_NIGHT_FOCUS_WHEN,
  DEFAULTS,
  getSettings,
  updateSettings,
  normalize,
  resetSettingsCache,
  SETTINGS_PATH,
  DATA_DIR,
};
