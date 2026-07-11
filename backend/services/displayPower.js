const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const INSTALLED_SCRIPT = '/usr/local/bin/displayproject-display-power';
const REPO_SCRIPT = path.join(__dirname, '../../scripts/raspberry-pi/display-power.sh');

function resolveCommand() {
  if (process.env.DISPLAY_POWER_CMD) {
    return process.env.DISPLAY_POWER_CMD;
  }
  if (fs.existsSync(INSTALLED_SCRIPT)) {
    return INSTALLED_SCRIPT;
  }
  if (process.platform !== 'win32' && fs.existsSync(REPO_SCRIPT)) {
    return REPO_SCRIPT;
  }
  return null;
}

function setDisplayPower(action) {
  const command = resolveCommand();
  if (!command) {
    return;
  }

  try {
    const child = spawn(command, [action], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.unref();
    child.on('error', (error) => {
      console.error('Display power command failed:', error.message);
    });
  } catch (error) {
    console.error('Display power command failed:', error.message);
  }
}

module.exports = { setDisplayPower, resolveCommand };
