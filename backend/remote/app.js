const statusEl = document.getElementById('status');
const apiKeyInput = document.getElementById('apiKey');
const serverUrlInput = document.getElementById('serverUrl');
const lockSection = document.getElementById('lockSection');
const controlsEl = document.getElementById('controls');
const unlockBtn = document.getElementById('unlockBtn');
const lockBtn = document.getElementById('lockBtn');
const widgetButtonsEl = document.getElementById('widgetButtons');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const WIDGET_LABELS = {
  stock: 'Stocks',
  news: 'News',
  timetable: 'Schedule',
  network: 'Network',
};

const UNLOCK_KEY = 'displayRemoteUnlocked';
const SESSION_API_KEY = 'displayControlApiKeySession';

const savedUrl = localStorage.getItem('displayControlServerUrl') || window.location.origin;
serverUrlInput.value = savedUrl;
apiKeyInput.value = sessionStorage.getItem(SESSION_API_KEY) || '';

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'remote-status remote-status--error' : 'remote-status';
}

function isUnlocked() {
  return sessionStorage.getItem(UNLOCK_KEY) === '1';
}

function setUnlocked(unlocked) {
  if (unlocked) {
    sessionStorage.setItem(UNLOCK_KEY, '1');
    sessionStorage.setItem(SESSION_API_KEY, apiKeyInput.value.trim());
  } else {
    sessionStorage.removeItem(UNLOCK_KEY);
    sessionStorage.removeItem(SESSION_API_KEY);
  }
}

function applyUnlockUi(unlocked) {
  lockSection.hidden = unlocked;
  controlsEl.hidden = !unlocked;
  if (unlocked) {
    setStatus('Unlocked');
  } else {
    setStatus('Enter API key to unlock');
  }
}

async function apiRequest(path, options = {}) {
  const baseUrl = serverUrlInput.value.replace(/\/$/, '');
  const apiKey = apiKeyInput.value.trim();

  localStorage.setItem('displayControlServerUrl', baseUrl);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    setUnlocked(false);
    applyUnlockUi(false);
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

function rebuildWidgetButtons(enabledWidgets) {
  widgetButtonsEl.innerHTML = '';

  const rotateBtn = document.createElement('button');
  rotateBtn.type = 'button';
  rotateBtn.dataset.widget = 'rotate';
  rotateBtn.textContent = 'Next Widget';
  rotateBtn.addEventListener('click', async () => {
    try {
      setStatus('Rotating widget...');
      await apiRequest('/api/display/widgets/rotate', { method: 'POST', body: '{}' });
      setStatus('Widget rotated');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  widgetButtonsEl.appendChild(rotateBtn);

  (enabledWidgets || []).forEach((key, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.widget = String(index);
    button.textContent = WIDGET_LABELS[key] || key;
    button.addEventListener('click', async () => {
      try {
        setStatus(`Switching to ${button.textContent}...`);
        await apiRequest('/api/display/widgets/set', {
          method: 'POST',
          body: JSON.stringify({ index }),
        });
        setStatus('Widget updated');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    widgetButtonsEl.appendChild(button);
  });
}

function syncBackgroundFields() {
  const mode = document.getElementById('settingBackgroundMode').value;
  document.getElementById('settingBackgroundColorRow').hidden = mode !== 'color';
  document.getElementById('settingBackgroundImageRow').hidden = mode !== 'image';
}

function fillSettingsForm(settings) {
  document.getElementById('settingLocation').value = settings.location || '';
  document.getElementById('settingSymbols').value = (settings.stockSymbols || []).join(',');
  document.getElementById('settingRotation').value = Math.round((settings.widgetRotationMs || 0) / 1000);
  document.getElementById('settingCalendarDays').value = settings.calendarDays ?? 1;
  document.getElementById('settingForecastDays').value = settings.forecastDays ?? 3;
  document.getElementById('settingNewsGeneral').checked = settings.newsGeneral !== false;
  document.getElementById('settingNewsTechnology').checked = settings.newsTechnology !== false;
  document.getElementById('settingBackgroundMode').value = settings.backgroundMode || 'default';
  document.getElementById('settingBackgroundColor').value = settings.backgroundColor || '#141212';
  document.getElementById('settingBackgroundImage').value = settings.backgroundImage || '';
  syncBackgroundFields();

  const enabled = new Set(settings.enabledWidgets || []);
  document.querySelectorAll('input[name="enabledWidget"]').forEach((input) => {
    input.checked = enabled.has(input.value);
  });

  rebuildWidgetButtons(settings.enabledWidgets || []);
}

function readSettingsForm() {
  const enabledWidgets = Array.from(document.querySelectorAll('input[name="enabledWidget"]:checked')).map(
    (input) => input.value
  );

  const rotationSeconds = parseInt(document.getElementById('settingRotation').value, 10);

  return {
    location: document.getElementById('settingLocation').value.trim(),
    stockSymbols: document
      .getElementById('settingSymbols')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    widgetRotationMs: Number.isNaN(rotationSeconds) ? 120000 : rotationSeconds * 1000,
    enabledWidgets,
    calendarDays: parseInt(document.getElementById('settingCalendarDays').value, 10) || 1,
    forecastDays: parseInt(document.getElementById('settingForecastDays').value, 10) || 3,
    newsGeneral: document.getElementById('settingNewsGeneral').checked,
    newsTechnology: document.getElementById('settingNewsTechnology').checked,
    backgroundMode: document.getElementById('settingBackgroundMode').value,
    backgroundColor: document.getElementById('settingBackgroundColor').value,
    backgroundImage: document.getElementById('settingBackgroundImage').value.trim(),
  };
}

async function loadSettings() {
  const settings = await apiRequest('/api/settings');
  fillSettingsForm(settings);
  return settings;
}

async function unlock() {
  try {
    setStatus('Unlocking...');
    await apiRequest('/api/display/auth/verify', { method: 'POST', body: '{}' });
    setUnlocked(true);
    applyUnlockUi(true);
    await loadSettings();
    setStatus('Unlocked');
  } catch (error) {
    setUnlocked(false);
    applyUnlockUi(false);
    setStatus(error.message, true);
  }
}

function lock() {
  setUnlocked(false);
  apiKeyInput.value = '';
  applyUnlockUi(false);
  setStatus('Locked');
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      setStatus(`Sending ${button.dataset.action}...`);
      await apiRequest('/api/display/power', {
        method: 'POST',
        body: JSON.stringify({ action: button.dataset.action }),
      });
      setStatus(`Display set to ${button.dataset.action}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

unlockBtn.addEventListener('click', unlock);
lockBtn.addEventListener('click', lock);
document.getElementById('settingBackgroundMode').addEventListener('change', syncBackgroundFields);

apiKeyInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    unlock();
  }
});

saveSettingsBtn.addEventListener('click', async () => {
  try {
    setStatus('Saving settings...');
    const updated = await apiRequest('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(readSettingsForm()),
    });
    fillSettingsForm(updated);
    setStatus('Settings saved');
  } catch (error) {
    setStatus(error.message, true);
  }
});

if (isUnlocked() && apiKeyInput.value.trim()) {
  unlock().catch(() => {
    lock();
  });
} else {
  applyUnlockUi(false);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/remote/sw.js').catch(() => {});
}
