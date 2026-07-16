const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const INSTALLED_SCRIPT = '/usr/local/bin/displayproject-display-brightness';
const REPO_SCRIPT = path.join(__dirname, '../../scripts/raspberry-pi/display-brightness.sh');

function resolveBrightnessCommand() {
  if (process.env.DISPLAY_BRIGHTNESS_CMD) {
    return process.env.DISPLAY_BRIGHTNESS_CMD;
  }
  if (fs.existsSync(INSTALLED_SCRIPT)) {
    return INSTALLED_SCRIPT;
  }
  if (process.platform !== 'win32' && fs.existsSync(REPO_SCRIPT)) {
    return REPO_SCRIPT;
  }
  return null;
}

function clampPercent(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

/**
 * Apply display brightness on the host (Raspberry Pi backlight / HDMI / xrandr).
 * No-ops when no brightness command is available (e.g. Windows dev).
 */
function setDisplayBrightness(percent) {
  const command = resolveBrightnessCommand();
  if (!command) {
    return false;
  }

  const value = clampPercent(percent);
  if (value == null) {
    return false;
  }

  try {
    const child = spawn(command, [String(value)], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        DISPLAY: process.env.DISPLAY || ':0',
      },
    });
    child.unref();
    child.on('error', (error) => {
      console.error('Display brightness command failed:', error.message);
    });
    return true;
  } catch (error) {
    console.error('Display brightness command failed:', error.message);
    return false;
  }
}

module.exports = {
  setDisplayBrightness,
  resolveBrightnessCommand,
  clampPercent,
};
