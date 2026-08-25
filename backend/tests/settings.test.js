const fs = require('fs');
const path = require('path');
const settings = require('../services/settings');

describe('settings service', () => {
  const settingsPath = settings.SETTINGS_PATH;
  let backup = null;

  beforeEach(() => {
    if (fs.existsSync(settingsPath)) {
      backup = fs.readFileSync(settingsPath, 'utf8');
      fs.unlinkSync(settingsPath);
    } else {
      backup = null;
    }
    settings.resetSettingsCache();
  });

  afterEach(() => {
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
    if (backup !== null) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, backup, 'utf8');
    }
    settings.resetSettingsCache();
  });

  test('getSettings returns defaults', () => {
    const result = settings.getSettings();
    expect(result.location).toBeTruthy();
    expect(result.stockSymbols).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    expect(result.enabledWidgets).toContain('stock');
    expect(result.enabledWidgets).toContain('sky');
    expect(result.enabledWidgets).toContain('spotify');
    expect(result.widgetRotationMs).toBe(120000);
  });

  test('updateSettings validates and persists', () => {
    const updated = settings.updateSettings({
      location: 'London',
      stockSymbols: ['msft', 'aapl!!'],
      stockChartMode: 'candles',
      widgetRotationMs: 60000,
      enabledWidgets: ['news', 'stock', 'bogus', 'globe'],
      calendarDays: 99,
      forecastDays: 0,
      newsGeneral: false,
      newsTechnology: true,
    });

    expect(updated.location).toBe('London');
    expect(updated.stockSymbols).toEqual(['MSFT', 'AAPL']);
    expect(updated.stockChartMode).toBe('candles');
    expect(updated.enabledWidgets).toEqual(['news', 'stock', 'globe']);
    expect(updated.calendarDays).toBe(7);
    expect(updated.forecastDays).toBe(1);
    expect(updated.newsGeneral).toBe(false);

    settings.resetSettingsCache();
    expect(settings.getSettings().location).toBe('London');
    expect(settings.getSettings().stockChartMode).toBe('candles');
    expect(settings.getSettings().enabledWidgets).toContain('globe');
  });

  test('updateSettings rejects unknown keys', () => {
    expect(() => settings.updateSettings({ secret: 'nope' })).toThrow(/Unknown settings keys/);
  });

  test('enabledWidgets falls back when empty', () => {
    const updated = settings.updateSettings({ enabledWidgets: [] });
    expect(updated.enabledWidgets.length).toBeGreaterThan(0);
  });

  test('globeCities sanitizes ids and falls back when empty', () => {
    const updated = settings.updateSettings({
      globeCities: ['paris', 'bogus', 'paris', 'tokyo'],
    });
    expect(updated.globeCities).toEqual(['paris', 'tokyo']);

    const cleared = settings.updateSettings({ globeCities: [] });
    expect(cleared.globeCities.length).toBeGreaterThan(0);
    expect(cleared.globeCities).toContain('london');
  });

  test('globeLayers sanitizes to allowlist', () => {
    expect(settings.getSettings().globeLayers).toBe('both');
    expect(settings.updateSettings({ globeLayers: 'radar' }).globeLayers).toBe('radar');
    expect(settings.updateSettings({ globeLayers: 'nope' }).globeLayers).toBe('both');
  });

  test('globeSatellites sanitizes NORAD ids and falls back when empty', () => {
    expect(settings.getSettings().globeSatellites).toEqual([29155]);
    const updated = settings.updateSettings({ globeSatellites: [29155, '25544', 29155, -1, 'x'] });
    expect(updated.globeSatellites).toEqual([29155, 25544]);
    const cleared = settings.updateSettings({ globeSatellites: [] });
    expect(cleared.globeSatellites).toEqual([29155]);
  });

  test('background settings sanitize mode colour and image URL', () => {
    const updated = settings.updateSettings({
      backgroundMode: 'image',
      backgroundColor: '#ABC',
      backgroundImage: 'https://example.com/bg.jpg',
    });

    expect(updated.backgroundMode).toBe('image');
    expect(updated.backgroundColor).toBe('#aabbcc');
    expect(updated.backgroundImage).toBe('https://example.com/bg.jpg');

    const cleared = settings.updateSettings({
      backgroundMode: 'bogus',
      backgroundColor: 'red',
      backgroundImage: 'javascript:alert(1)',
    });
    expect(cleared.backgroundMode).toBe('default');
    expect(cleared.backgroundColor).toBe('#101115');
    expect(cleared.backgroundImage).toBe('');
  });

  test('appearance and layout presets sanitize to allowlists', () => {
    const updated = settings.updateSettings({
      colorScheme: 'cool-blue',
      fontPreset: 'time-caps',
      clockSide: 'right',
      density: 'compact',
      sectionOrder: ['widgets', 'header', 'bogus', 'weather', 'header'],
    });

    expect(updated.colorScheme).toBe('cool-blue');
    expect(updated.fontPreset).toBe('time-caps');
    expect(updated.clockSide).toBe('right');
    expect(updated.density).toBe('compact');
    expect(updated.sectionOrder).toEqual(['widgets', 'header', 'weather']);

    const fallback = settings.updateSettings({
      colorScheme: 'neon',
      fontPreset: 'comic',
      clockSide: 'top',
      density: 'huge',
      sectionOrder: [],
    });
    expect(fallback.colorScheme).toBe('orange-dark');
    expect(fallback.fontPreset).toBe('nothing');
    expect(fallback.clockSide).toBe('left');
    expect(fallback.density).toBe('comfortable');
    expect(fallback.sectionOrder).toEqual(['header', 'weather', 'widgets']);
  });

  test('custom colour scheme persists and sanitizes hex values', () => {
    const updated = settings.updateSettings({
      colorScheme: 'custom',
      customAccent: '#ABC',
      customBgApp: '#112233',
      customBgPanel: '#445566',
      customBgCard: '#778899',
    });

    expect(updated.colorScheme).toBe('custom');
    expect(updated.customAccent).toBe('#aabbcc');
    expect(updated.customBgApp).toBe('#112233');
    expect(updated.customBgPanel).toBe('#445566');
    expect(updated.customBgCard).toBe('#778899');

    const cleared = settings.updateSettings({
      customAccent: 'orange',
      customBgApp: 'not-a-color',
      customBgPanel: 'javascript:alert(1)',
      customBgCard: '#gg0000',
    });
    expect(cleared.customAccent).toBe('#ff6a1a');
    expect(cleared.customBgApp).toBe('#101115');
    expect(cleared.customBgPanel).toBe('#1a1c21');
    expect(cleared.customBgCard).toBe('#26282e');

    const transparent = settings.updateSettings({
      customBgApp: 'transparent',
      customBgPanel: 'Transparent',
      customBgCard: 'transparent',
    });
    expect(transparent.customBgApp).toBe('transparent');
    expect(transparent.customBgPanel).toBe('transparent');
    expect(transparent.customBgCard).toBe('transparent');
  });

  test('clock animation, focus schedule, and brightness sanitize', () => {
    const updated = settings.updateSettings({
      clockAnimation: 'flip',
      clockSize: 'large',
      clockFontSize: 'xl',
      weatherAtmosphere: true,
      nightFocusMode: true,
      nightFocusWhen: 'custom',
      nightFocusStartHour: 21,
      nightFocusEndHour: 7,
      displayBrightness: 70,
    });
    expect(updated.clockAnimation).toBe('flip');
    expect(updated.clockSize).toBe('large');
    expect(updated.clockFontSize).toBe('xl');
    expect(updated.weatherAtmosphere).toBe(true);
    expect(updated.nightFocusMode).toBe(true);
    expect(updated.nightFocusWhen).toBe('custom');
    expect(updated.nightFocusStartHour).toBe(21);
    expect(updated.nightFocusEndHour).toBe(7);
    expect(updated.displayBrightness).toBe(70);

    const fallback = settings.updateSettings({
      clockAnimation: 'bounce',
      clockSize: 'huge',
      clockFontSize: 'tiny',
      weatherAtmosphere: 0,
      nightFocusMode: '',
      nightFocusWhen: 'sometime',
      nightFocusStartHour: 99,
      nightFocusEndHour: -3,
      displayBrightness: 5,
    });
    expect(fallback.clockAnimation).toBe('off');
    expect(fallback.clockSize).toBe('large');
    expect(fallback.clockFontSize).toBe('lg');
    expect(fallback.weatherAtmosphere).toBe(false);
    expect(fallback.nightFocusMode).toBe(false);
    expect(fallback.nightFocusWhen).toBe('auto');
    expect(fallback.nightFocusStartHour).toBe(23);
    expect(fallback.nightFocusEndHour).toBe(0);
    expect(fallback.displayBrightness).toBe(10);
  });
});
