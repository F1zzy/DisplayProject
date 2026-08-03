const fs = require('fs');
const path = require('path');
const { resolveCommand } = require('../services/displayPower');

const REPO_SCRIPT = path.join(__dirname, '../../scripts/raspberry-pi/display-power.sh');

describe('displayPower', () => {
  const originalEnv = process.env.DISPLAY_POWER_CMD;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DISPLAY_POWER_CMD;
    } else {
      process.env.DISPLAY_POWER_CMD = originalEnv;
    }
  });

  test('resolveCommand returns env override when set', () => {
    process.env.DISPLAY_POWER_CMD = '/custom/display-power.sh';
    expect(resolveCommand()).toBe('/custom/display-power.sh');
  });

  test('resolveCommand falls back to repo script on non-Windows when available', () => {
    delete process.env.DISPLAY_POWER_CMD;
    if (process.platform !== 'win32' && fs.existsSync(REPO_SCRIPT)) {
      expect(resolveCommand()).toBe(REPO_SCRIPT);
    } else {
      expect(resolveCommand()).toBeNull();
    }
  });
});
