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
    expect(result.widgetRotationMs).toBe(120000);
  });

  test('updateSettings validates and persists', () => {
    const updated = settings.updateSettings({
      location: 'London',
      stockSymbols: ['msft', 'aapl!!'],
      widgetRotationMs: 60000,
      enabledWidgets: ['news', 'stock', 'bogus'],
      calendarDays: 99,
      forecastDays: 0,
      newsGeneral: false,
      newsTechnology: true,
    });

    expect(updated.location).toBe('London');
    expect(updated.stockSymbols).toEqual(['MSFT', 'AAPL']);
    expect(updated.enabledWidgets).toEqual(['news', 'stock']);
    expect(updated.calendarDays).toBe(7);
    expect(updated.forecastDays).toBe(1);
    expect(updated.newsGeneral).toBe(false);

    settings.resetSettingsCache();
    expect(settings.getSettings().location).toBe('London');
  });

  test('updateSettings rejects unknown keys', () => {
    expect(() => settings.updateSettings({ secret: 'nope' })).toThrow(/Unknown settings keys/);
  });

  test('enabledWidgets falls back when empty', () => {
    const updated = settings.updateSettings({ enabledWidgets: [] });
    expect(updated.enabledWidgets.length).toBeGreaterThan(0);
  });

  test('background settings sanitize mode colour and image URL', () => {
    const updated = settings.updateSettings({
      backgroundMode: 'image',
      backgroundColor: '#ABC',
      backgroundImage: 'https://example.com/bg.jpg',
    });

    expect(updated.backgroundMode).toBe('image');
    expect(updated.backgroundColor).toBe('#abc');
    expect(updated.backgroundImage).toBe('https://example.com/bg.jpg');

    const cleared = settings.updateSettings({
      backgroundMode: 'bogus',
      backgroundColor: 'red',
      backgroundImage: 'javascript:alert(1)',
    });
    expect(cleared.backgroundMode).toBe('default');
    expect(cleared.backgroundColor).toBe('#141212');
    expect(cleared.backgroundImage).toBe('');
  });
});
