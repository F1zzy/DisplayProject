/** Curated colour / font presets applied as CSS variables on :root. */

const COLOR_SCHEME_VARS = {
  'orange-dark': {
    '--bg-app': '#101115',
    '--bg-panel': '#1a1c21',
    '--bg-panel-elevated': '#1e2025',
    '--bg-card': '#26282e',
    '--bg-card-hover': '#2c2e34',
    '--accent': '#ff6a1a',
    '--accent-soft': 'rgba(255, 106, 26, 0.18)',
    '--accent-light': '#ff8a4a',
    '--text-primary': '#e8e8ea',
    '--text-secondary': '#b7b8bd',
    '--text-muted': '#8a8c92',
    '--border': '#2c2e34',
    '--border-strong': '#35373d',
  },
  'cool-blue': {
    '--bg-app': '#0c1018',
    '--bg-panel': '#141a24',
    '--bg-panel-elevated': '#1a2230',
    '--bg-card': '#222c3c',
    '--bg-card-hover': '#2a3648',
    '--accent': '#4da3ff',
    '--accent-soft': 'rgba(77, 163, 255, 0.18)',
    '--accent-light': '#7abcff',
    '--text-primary': '#e6eef8',
    '--text-secondary': '#a8b8cc',
    '--text-muted': '#7a8ca0',
    '--border': '#2a3444',
    '--border-strong': '#354256',
  },
  'soft-neutral': {
    '--bg-app': '#161618',
    '--bg-panel': '#1e1e22',
    '--bg-panel-elevated': '#242428',
    '--bg-card': '#2c2c32',
    '--bg-card-hover': '#34343a',
    '--accent': '#c4a574',
    '--accent-soft': 'rgba(196, 165, 116, 0.2)',
    '--accent-light': '#d4b88a',
    '--text-primary': '#ececec',
    '--text-secondary': '#b8b8bc',
    '--text-muted': '#8e8e94',
    '--border': '#34343a',
    '--border-strong': '#3e3e46',
  },
  forest: {
    '--bg-app': '#0d1210',
    '--bg-panel': '#141c18',
    '--bg-panel-elevated': '#1a2420',
    '--bg-card': '#222e28',
    '--bg-card-hover': '#2a3830',
    '--accent': '#5ecf8a',
    '--accent-soft': 'rgba(94, 207, 138, 0.18)',
    '--accent-light': '#7fdba2',
    '--text-primary': '#e6f0ea',
    '--text-secondary': '#a8c0b0',
    '--text-muted': '#7a9486',
    '--border': '#2a3830',
    '--border-strong': '#354840',
  },
};

const FONT_PRESET_VARS = {
  nothing: {
    '--font-display': "'NothingFont', 'Time-Font', 'Segoe UI', sans-serif",
    '--font-body': "'NothingFont', 'Segoe UI', sans-serif",
  },
  'time-caps': {
    '--font-display': "'Time-Font', 'NothingFont', 'Segoe UI', sans-serif",
    '--font-body': "'Time-Font', 'Segoe UI', sans-serif",
  },
  system: {
    '--font-display':
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    '--font-body':
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  },
};

const COLOR_VAR_KEYS = Object.keys(COLOR_SCHEME_VARS['orange-dark']);
const FONT_VAR_KEYS = Object.keys(FONT_PRESET_VARS.nothing);

const DEFAULT_COLOR_SCHEME = 'orange-dark';
const DEFAULT_FONT_PRESET = 'nothing';

const DEFAULT_CUSTOM_COLORS = {
  accent: COLOR_SCHEME_VARS['orange-dark']['--accent'],
  bgApp: COLOR_SCHEME_VARS['orange-dark']['--bg-app'],
  bgPanel: COLOR_SCHEME_VARS['orange-dark']['--bg-panel'],
  bgCard: COLOR_SCHEME_VARS['orange-dark']['--bg-card'],
};

function parseHex(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) {
    return { r: 16, g: 17, b: 21 };
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function lighten(hex, amount) {
  const { r, g, b } = parseHex(hex);
  return toHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isTransparent(value) {
  return String(value || '').trim().toLowerCase() === 'transparent';
}

function derivedSurface(base, amount) {
  if (isTransparent(base)) return 'transparent';
  return lighten(base, amount);
}

/** Build full CSS var map from custom accent / surface colours. */
export function buildCustomColorVars({
  accent = DEFAULT_CUSTOM_COLORS.accent,
  bgApp = DEFAULT_CUSTOM_COLORS.bgApp,
  bgPanel = DEFAULT_CUSTOM_COLORS.bgPanel,
  bgCard = DEFAULT_CUSTOM_COLORS.bgCard,
} = {}) {
  const cardTransparent = isTransparent(bgCard);
  return {
    '--bg-app': isTransparent(bgApp) ? 'transparent' : bgApp,
    '--bg-panel': isTransparent(bgPanel) ? 'transparent' : bgPanel,
    '--bg-panel-elevated': derivedSurface(bgPanel, 0.06),
    '--bg-card': cardTransparent ? 'transparent' : bgCard,
    '--bg-card-hover': derivedSurface(bgCard, 0.08),
    '--accent': accent,
    '--accent-soft': rgbaFromHex(accent, 0.18),
    '--accent-light': lighten(accent, 0.25),
    '--text-primary': '#e8e8ea',
    '--text-secondary': '#b7b8bd',
    '--text-muted': '#8a8c92',
    '--border': cardTransparent ? 'rgba(255, 255, 255, 0.12)' : lighten(bgCard, 0.05),
    '--border-strong': cardTransparent ? 'rgba(255, 255, 255, 0.2)' : lighten(bgCard, 0.12),
  };
}

export function resolveColorSchemeVars(settings = {}) {
  const colorScheme = settings.colorScheme || DEFAULT_COLOR_SCHEME;
  if (colorScheme === 'custom') {
    return buildCustomColorVars({
      accent: settings.customAccent || DEFAULT_CUSTOM_COLORS.accent,
      bgApp: settings.customBgApp || DEFAULT_CUSTOM_COLORS.bgApp,
      bgPanel: settings.customBgPanel || DEFAULT_CUSTOM_COLORS.bgPanel,
      bgCard: settings.customBgCard || DEFAULT_CUSTOM_COLORS.bgCard,
    });
  }
  return COLOR_SCHEME_VARS[colorScheme] || COLOR_SCHEME_VARS[DEFAULT_COLOR_SCHEME];
}

/** Chart.js-friendly font family string for the active (or given) preset. */
export function getChartFontFamily(fontPreset) {
  const preset =
    fontPreset && FONT_PRESET_VARS[fontPreset]
      ? fontPreset
      : typeof document !== 'undefined'
        ? null
        : DEFAULT_FONT_PRESET;

  if (preset && FONT_PRESET_VARS[preset]) {
    return FONT_PRESET_VARS[preset]['--font-body'].replace(/"/g, '');
  }

  if (typeof document !== 'undefined') {
    const computed = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-body')
      .trim();
    if (computed) return computed.replace(/"/g, '');
  }

  return FONT_PRESET_VARS[DEFAULT_FONT_PRESET]['--font-body'].replace(/"/g, '');
}

function setVars(root, vars) {
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function clearVars(root, keys) {
  keys.forEach((key) => root.style.removeProperty(key));
}

/**
 * Apply colour scheme + font preset CSS variables on documentElement.
 * Defaults clear inline overrides so theme.css :root values apply again.
 */
export function applyDashboardAppearance(settings = {}) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const colorScheme = settings.colorScheme || DEFAULT_COLOR_SCHEME;
  const fontPreset = settings.fontPreset || DEFAULT_FONT_PRESET;

  const colorVars = resolveColorSchemeVars(settings);
  const fontVars = FONT_PRESET_VARS[fontPreset] || FONT_PRESET_VARS[DEFAULT_FONT_PRESET];

  if (colorScheme === DEFAULT_COLOR_SCHEME) {
    clearVars(root, COLOR_VAR_KEYS);
  } else {
    setVars(root, colorVars);
  }

  if (fontPreset === DEFAULT_FONT_PRESET) {
    clearVars(root, FONT_VAR_KEYS);
  } else {
    setVars(root, fontVars);
  }
}

export {
  COLOR_SCHEME_VARS,
  FONT_PRESET_VARS,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_FONT_PRESET,
  DEFAULT_CUSTOM_COLORS,
};
