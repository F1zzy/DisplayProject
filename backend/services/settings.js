const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
/** Override with DISPLAY_SETTINGS_PATH for isolated E2E / test runs. */
const SETTINGS_PATH = process.env.DISPLAY_SETTINGS_PATH
  ? path.resolve(process.env.DISPLAY_SETTINGS_PATH)
  : path.join(DATA_DIR, 'settings.json');

const VALID_WIDGETS = ['stock', 'news', 'timetable', 'network', 'sky', 'spotify', 'f1', 'globe'];

const VALID_BACKGROUND_MODES = ['default', 'color', 'image'];

const VALID_COLOR_SCHEMES = ['orange-dark', 'cool-blue', 'soft-neutral', 'forest', 'custom'];

const VALID_FONT_PRESETS = ['nothing', 'time-caps', 'system'];

const VALID_SECTIONS = ['header', 'weather', 'widgets'];

const VALID_CLOCK_SIDES = ['left', 'right'];

const VALID_DENSITIES = ['compact', 'comfortable', 'roomy'];

const VALID_CLOCK_ANIMATIONS = ['off', 'crossfade', 'flip'];

const VALID_CLOCK_SIZES = ['small', 'medium', 'large'];

const VALID_CLOCK_FONT_SIZES = ['sm', 'md', 'lg', 'xl'];

const VALID_NIGHT_FOCUS_WHEN = ['auto', 'always', 'custom'];

const VALID_STOCK_CHART_MODES = ['line', 'candles'];

const { DEFAULT_GLOBE_CITIES, sanitizeGlobeCityIds } = require('./globeCities');

const DEFAULTS = {
  location: process.env.LOCATION || 'Nottingham',
  stockSymbols: ['AAPL', 'GOOGL', 'MSFT'],
  stockChartMode: 'line',
  widgetRotationMs: 120000,
  enabledWidgets: [...VALID_WIDGETS],
  globeCities: [...DEFAULT_GLOBE_CITIES],
  calendarDays: 1,
  newsGeneral: true,
  newsTechnology: true,
  forecastDays: 3,
  backgroundMode: 'default',
  backgroundColor: '#101115',
  backgroundImage: '',
  colorScheme: 'orange-dark',
  customAccent: '#ff6a1a',
  customBgApp: '#101115',
  customBgPanel: '#1a1c21',
  customBgCard: '#26282e',
  fontPreset: 'nothing',
  sectionOrder: [...VALID_SECTIONS],
  clockSide: 'left',
  density: 'comfortable',
  clockAnimation: 'off',
  clockSize: 'large',
  clockFontSize: 'lg',
  weatherAtmosphere: false,
  nightFocusMode: false,
  nightFocusWhen: 'auto',
  nightFocusStartHour: 20,
  nightFocusEndHour: 6,
  displayBrightness: 100,
  spotifyLyricsBackground: true,
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

function sanitizeHexColor(value, fallback) {
  let color = String(value || '').trim();
  if (/^#([0-9a-fA-F]{3})$/.test(color)) {
    color = `#${color
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
    return color.toLowerCase();
  }
  return fallback;
}

/** Hex colour, or the keyword `transparent` for custom surface fields. */
function sanitizeSurfaceColor(value, fallback) {
  if (String(value || '').trim().toLowerCase() === 'transparent') {
    return 'transparent';
  }
  return sanitizeHexColor(value, fallback);
}

function sanitizeBackgroundColor(value) {
  return sanitizeHexColor(value, DEFAULTS.backgroundColor);
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
    stockChartMode: sanitizeFromList(
      merged.stockChartMode,
      VALID_STOCK_CHART_MODES,
      DEFAULTS.stockChartMode
    ),
    widgetRotationMs: clampInt(merged.widgetRotationMs, 0, 3600000, DEFAULTS.widgetRotationMs),
    enabledWidgets: sanitizeEnabledWidgets(merged.enabledWidgets),
    globeCities: sanitizeGlobeCityIds(merged.globeCities),
    calendarDays: clampInt(merged.calendarDays, 1, 7, DEFAULTS.calendarDays),
    newsGeneral: Boolean(merged.newsGeneral),
    newsTechnology: Boolean(merged.newsTechnology),
    forecastDays: clampInt(merged.forecastDays, 1, 7, DEFAULTS.forecastDays),
    backgroundMode: sanitizeBackgroundMode(merged.backgroundMode),
    backgroundColor: sanitizeBackgroundColor(merged.backgroundColor),
    backgroundImage: sanitizeBackgroundImage(merged.backgroundImage),
    colorScheme: sanitizeFromList(merged.colorScheme, VALID_COLOR_SCHEMES, DEFAULTS.colorScheme),
    customAccent: sanitizeHexColor(merged.customAccent, DEFAULTS.customAccent),
    customBgApp: sanitizeSurfaceColor(merged.customBgApp, DEFAULTS.customBgApp),
    customBgPanel: sanitizeSurfaceColor(merged.customBgPanel, DEFAULTS.customBgPanel),
    customBgCard: sanitizeSurfaceColor(merged.customBgCard, DEFAULTS.customBgCard),
    fontPreset: sanitizeFromList(merged.fontPreset, VALID_FONT_PRESETS, DEFAULTS.fontPreset),
    sectionOrder: sanitizeSectionOrder(merged.sectionOrder),
    clockSide: sanitizeFromList(merged.clockSide, VALID_CLOCK_SIDES, DEFAULTS.clockSide),
    density: sanitizeFromList(merged.density, VALID_DENSITIES, DEFAULTS.density),
    clockAnimation: sanitizeFromList(
      merged.clockAnimation,
      VALID_CLOCK_ANIMATIONS,
      DEFAULTS.clockAnimation
    ),
    clockSize: sanitizeFromList(merged.clockSize, VALID_CLOCK_SIZES, DEFAULTS.clockSize),
    clockFontSize: sanitizeFromList(
      merged.clockFontSize,
      VALID_CLOCK_FONT_SIZES,
      DEFAULTS.clockFontSize
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
    spotifyLyricsBackground:
      merged.spotifyLyricsBackground === undefined
        ? DEFAULTS.spotifyLyricsBackground
        : Boolean(merged.spotifyLyricsBackground),
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
    globeCities: [...(cache.globeCities || DEFAULT_GLOBE_CITIES)],
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
  VALID_CLOCK_SIZES,
  VALID_CLOCK_FONT_SIZES,
  VALID_NIGHT_FOCUS_WHEN,
  VALID_STOCK_CHART_MODES,
  DEFAULTS,
  getSettings,
  updateSettings,
  normalize,
  resetSettingsCache,
  SETTINGS_PATH,
  DATA_DIR,
};
