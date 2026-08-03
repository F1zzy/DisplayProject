const fs = require('fs');
const path = require('path');
const {
  resolveBrightnessCommand,
  clampPercent,
} = require('../services/displayBrightness');

const REPO_SCRIPT = path.join(__dirname, '../../scripts/raspberry-pi/display-brightness.sh');

describe('displayBrightness', () => {
  const originalEnv = process.env.DISPLAY_BRIGHTNESS_CMD;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DISPLAY_BRIGHTNESS_CMD;
    } else {
      process.env.DISPLAY_BRIGHTNESS_CMD = originalEnv;
    }
  });

  test('resolveBrightnessCommand returns env override when set', () => {
    process.env.DISPLAY_BRIGHTNESS_CMD = '/custom/display-brightness.sh';
    expect(resolveBrightnessCommand()).toBe('/custom/display-brightness.sh');
  });

  test('resolveBrightnessCommand falls back to repo script on non-Windows when available', () => {
    delete process.env.DISPLAY_BRIGHTNESS_CMD;
    if (process.platform !== 'win32' && fs.existsSync(REPO_SCRIPT)) {
      expect(resolveBrightnessCommand()).toBe(REPO_SCRIPT);
    } else {
      expect(resolveBrightnessCommand()).toBeNull();
    }
  });

  test('clampPercent bounds values', () => {
    expect(clampPercent(70)).toBe(70);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent('nope')).toBeNull();
  });
});
