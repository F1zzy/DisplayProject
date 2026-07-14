const DEFAULT_BODY_BACKGROUND =
  'radial-gradient(circle at top, #2a2626 0%, var(--bg-app) 45%)';

/**
 * Build inline background style for the dashboard shell from settings.
 * Returns null for the built-in default gradient (handled by CSS).
 */
export function buildDashboardBackgroundStyle(settings = {}) {
  const mode = settings.backgroundMode || 'default';

  if (mode === 'color') {
    const color = settings.backgroundColor || '#141212';
    return {
      backgroundColor: color,
      backgroundImage: 'none',
    };
  }

  if (mode === 'image' && settings.backgroundImage) {
    return {
      backgroundColor: settings.backgroundColor || '#141212',
      backgroundImage: `url("${settings.backgroundImage.replace(/"/g, '\\"')}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    };
  }

  return null;
}

/** Apply matching background on document.body so edges match the app shell. */
export function applyDocumentBackground(settings = {}) {
  if (typeof document === 'undefined') return;

  const style = buildDashboardBackgroundStyle(settings);
  if (!style) {
    document.body.style.background = DEFAULT_BODY_BACKGROUND;
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundAttachment = '';
    return;
  }

  document.body.style.background = '';
  document.body.style.backgroundColor = style.backgroundColor || '';
  document.body.style.backgroundImage = style.backgroundImage || '';
  document.body.style.backgroundSize = style.backgroundSize || '';
  document.body.style.backgroundPosition = style.backgroundPosition || '';
  document.body.style.backgroundRepeat = style.backgroundRepeat || '';
  document.body.style.backgroundAttachment = style.backgroundAttachment || '';
}
