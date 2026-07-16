const statusEl = document.getElementById('status');
const statusPill = document.getElementById('statusPill');
const apiKeyInput = document.getElementById('apiKey');
const serverUrlInput = document.getElementById('serverUrl');
const lockSection = document.getElementById('lockSection');
const controlsEl = document.getElementById('controls');
const unlockBtn = document.getElementById('unlockBtn');
const lockBtn = document.getElementById('lockBtn');
const widgetButtonsEl = document.getElementById('widgetButtons');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const saveBtnLabel = document.getElementById('saveBtnLabel');
const powerStateBadge = document.getElementById('powerStateBadge');

const WIDGET_LABELS = {
  stock: 'Stocks',
  news: 'News',
  timetable: 'Schedule',
  network: 'Network',
  sky: 'Night Sky',
  spotify: 'Spotify',
};

const SECTION_LABELS = {
  header: 'Header / clock',
  weather: 'Weather',
  widgets: 'Widgets',
};

const ALL_SECTIONS = ['header', 'weather', 'widgets'];

/** @type {string[]} ordered visible sections; omitted = hidden */
let sectionOrderState = [...ALL_SECTIONS];

const UNLOCK_KEY = 'displayRemoteUnlocked';
const SESSION_API_KEY = 'displayControlApiKeySession';

const savedUrl = localStorage.getItem('displayControlServerUrl') || window.location.origin;
serverUrlInput.value = savedUrl;
apiKeyInput.value = sessionStorage.getItem(SESSION_API_KEY) || '';

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = 'remote-status is-updating';
  if (isError) statusEl.classList.add('remote-status--error');
  else if (/saved|unlocked|rotated|updated|set to/i.test(message)) {
    statusEl.classList.add('remote-status--ok');
  }
  requestAnimationFrame(() => {
    statusEl.classList.remove('is-updating');
    void statusEl.offsetWidth;
    statusEl.classList.add('is-updating');
  });
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
  lockBtn.hidden = !unlocked;
  document.body.classList.toggle('is-unlocked', unlocked);
  statusPill.textContent = unlocked ? 'UNLOCKED' : 'LOCKED';

  if (unlocked) {
    setStatus('Unlocked');
    // restart panel enter animations
    controlsEl.querySelectorAll('.anim-in').forEach((el) => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  } else {
    setStatus('Enter API key to unlock');
  }
}

function flashButton(button) {
  if (!button) return;
  button.classList.remove('is-flash', 'is-active');
  void button.offsetWidth;
  button.classList.add('is-flash', 'is-active');
  window.setTimeout(() => button.classList.remove('is-active'), 450);
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

let remotePinned = false;

function setRemotePinnedUi(pinned, currentWidget) {
  remotePinned = Boolean(pinned);
  const pinBtn = document.getElementById('pinWidgetBtn');
  const unpinBtn = document.getElementById('unpinWidgetBtn');
  const pinSelect = document.getElementById('pinWidgetSelect');
  if (pinBtn) pinBtn.hidden = remotePinned;
  if (unpinBtn) unpinBtn.hidden = !remotePinned;
  if (pinSelect) {
    pinSelect.disabled = remotePinned;
    if (typeof currentWidget === 'number' && !Number.isNaN(currentWidget)) {
      pinSelect.value = String(currentWidget);
    }
  }
}

async function refreshDisplayState() {
  try {
    const state = await apiRequest('/api/display/state');
    setRemotePinnedUi(state.pinned, state.currentWidget);
    return state;
  } catch {
    return null;
  }
}

function rebuildWidgetButtons(enabledWidgets) {
  widgetButtonsEl.innerHTML = '';
  const widgets = enabledWidgets || [];

  const rotateBtn = document.createElement('button');
  rotateBtn.type = 'button';
  rotateBtn.className = 'chip';
  rotateBtn.dataset.widget = 'rotate';
  rotateBtn.textContent = 'Next Widget';
  rotateBtn.addEventListener('click', async () => {
    try {
      setStatus('Rotating widget...');
      const live = await apiRequest('/api/display/widgets/rotate', { method: 'POST', body: '{}' });
      setRemotePinnedUi(live?.pinned, live?.currentWidget);
      flashButton(rotateBtn);
      setStatus('Widget rotated');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  widgetButtonsEl.appendChild(rotateBtn);

  const unpinBtn = document.createElement('button');
  unpinBtn.type = 'button';
  unpinBtn.id = 'unpinWidgetBtn';
  unpinBtn.className = 'chip';
  unpinBtn.textContent = 'Unpin';
  unpinBtn.hidden = !remotePinned;
  unpinBtn.addEventListener('click', async () => {
    try {
      setStatus('Unpinning widget...');
      const live = await apiRequest('/api/display/widgets/pin', {
        method: 'POST',
        body: JSON.stringify({ pinned: false }),
      });
      setRemotePinnedUi(live?.pinned, live?.currentWidget);
      flashButton(unpinBtn);
      setStatus('Widget unpinned');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  widgetButtonsEl.appendChild(unpinBtn);

  widgets.forEach((key, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.widget = String(index);
    button.textContent = WIDGET_LABELS[key] || key;
    button.addEventListener('click', async () => {
      try {
        setStatus(`Switching to ${button.textContent}...`);
        const live = await apiRequest('/api/display/widgets/set', {
          method: 'POST',
          body: JSON.stringify({ index }),
        });
        setRemotePinnedUi(live?.pinned, live?.currentWidget);
        flashButton(button);
        setStatus('Widget updated');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    widgetButtonsEl.appendChild(button);
  });

  const pinRow = document.createElement('div');
  pinRow.className = 'pin-row';
  pinRow.id = 'pinWidgetRow';

  const pinLabel = document.createElement('label');
  pinLabel.className = 'pin-field';
  pinLabel.htmlFor = 'pinWidgetSelect';

  const pinLabelText = document.createElement('span');
  pinLabelText.className = 'field-label';
  pinLabelText.textContent = 'Pin widget';
  pinLabel.appendChild(pinLabelText);

  const pinSelect = document.createElement('select');
  pinSelect.id = 'pinWidgetSelect';
  pinSelect.disabled = remotePinned;
  widgets.forEach((key, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = WIDGET_LABELS[key] || key;
    pinSelect.appendChild(option);
  });
  pinLabel.appendChild(pinSelect);
  pinRow.appendChild(pinLabel);

  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.id = 'pinWidgetBtn';
  pinBtn.className = 'chip';
  pinBtn.textContent = 'Pin';
  pinBtn.hidden = remotePinned;
  pinBtn.disabled = widgets.length === 0;
  pinBtn.addEventListener('click', async () => {
    try {
      const index = parseInt(pinSelect.value, 10);
      const label = pinSelect.options[pinSelect.selectedIndex]?.textContent || 'widget';
      setStatus(`Pinning ${label}...`);
      const live = await apiRequest('/api/display/widgets/pin', {
        method: 'POST',
        body: JSON.stringify({ pinned: true, index }),
      });
      setRemotePinnedUi(live?.pinned, live?.currentWidget);
      flashButton(pinBtn);
      setStatus(`${label} pinned`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  pinRow.appendChild(pinBtn);
  widgetButtonsEl.appendChild(pinRow);
}

function syncBackgroundFields() {
  const mode = document.getElementById('settingBackgroundMode').value;
  document.getElementById('settingBackgroundColorRow').hidden = mode !== 'color';
  document.getElementById('settingBackgroundImageRow').hidden = mode !== 'image';
}

function normalizeSectionOrder(order) {
  const seen = new Set();
  const result = [];
  for (const id of order || []) {
    if (ALL_SECTIONS.includes(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result.length > 0 ? result : [...ALL_SECTIONS];
}

function renderSectionOrderList() {
  const list = document.getElementById('sectionOrderList');
  if (!list) return;

  const visible = new Set(sectionOrderState);
  const displayOrder = [
    ...sectionOrderState,
    ...ALL_SECTIONS.filter((id) => !visible.has(id)),
  ];

  list.innerHTML = '';
  displayOrder.forEach((id, index) => {
    const isVisible = visible.has(id);
    const row = document.createElement('div');
    row.className = `section-order-row${isVisible ? '' : ' is-hidden-section'}`;
    row.dataset.section = id;
    row.setAttribute('role', 'listitem');

    const label = document.createElement('span');
    label.className = 'section-order-label';
    label.textContent = SECTION_LABELS[id] || id;

    const checkLabel = document.createElement('label');
    checkLabel.className = 'section-order-check';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isVisible;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!sectionOrderState.includes(id)) {
          sectionOrderState = normalizeSectionOrder([...sectionOrderState, id]);
        }
      } else if (sectionOrderState.length > 1) {
        sectionOrderState = sectionOrderState.filter((s) => s !== id);
      } else {
        checkbox.checked = true;
        setStatus('Keep at least one section visible', true);
        return;
      }
      renderSectionOrderList();
    });
    checkLabel.appendChild(checkbox);
    checkLabel.appendChild(document.createTextNode('Show'));

    const moves = document.createElement('div');
    moves.className = 'section-order-moves';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '↑';
    upBtn.setAttribute('aria-label', `Move ${SECTION_LABELS[id]} up`);
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index === 0) return;
      const next = [...displayOrder];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      sectionOrderState = normalizeSectionOrder(next.filter((s) => visible.has(s)));
      renderSectionOrderList();
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '↓';
    downBtn.setAttribute('aria-label', `Move ${SECTION_LABELS[id]} down`);
    downBtn.disabled = index === displayOrder.length - 1;
    downBtn.addEventListener('click', () => {
      if (index >= displayOrder.length - 1) return;
      const next = [...displayOrder];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      sectionOrderState = normalizeSectionOrder(next.filter((s) => visible.has(s)));
      renderSectionOrderList();
    });

    moves.appendChild(upBtn);
    moves.appendChild(downBtn);

    row.appendChild(label);
    row.appendChild(checkLabel);
    row.appendChild(moves);
    list.appendChild(row);
  });
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
  document.getElementById('settingBackgroundColor').value = settings.backgroundColor || '#101115';
  document.getElementById('settingBackgroundImage').value = settings.backgroundImage || '';
  document.getElementById('settingColorScheme').value = settings.colorScheme || 'orange-dark';
  document.getElementById('settingFontPreset').value = settings.fontPreset || 'nothing';
  document.getElementById('settingClockAnimation').value = settings.clockAnimation || 'off';
  document.getElementById('settingWeatherAtmosphere').checked = settings.weatherAtmosphere === true;
  document.getElementById('settingNightFocusMode').checked = settings.nightFocusMode === true;
  document.getElementById('settingClockSide').value = settings.clockSide || 'left';
  document.getElementById('settingDensity').value = settings.density || 'comfortable';
  syncBackgroundFields();

  sectionOrderState = normalizeSectionOrder(settings.sectionOrder);
  renderSectionOrderList();

  const enabled = new Set(settings.enabledWidgets || []);
  document.querySelectorAll('input[name="enabledWidget"]').forEach((input) => {
    input.checked = enabled.has(input.value);
  });

  rebuildWidgetButtons(settings.enabledWidgets || []);
  refreshDisplayState();
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
    colorScheme: document.getElementById('settingColorScheme').value,
    fontPreset: document.getElementById('settingFontPreset').value,
    clockAnimation: document.getElementById('settingClockAnimation').value,
    weatherAtmosphere: document.getElementById('settingWeatherAtmosphere').checked,
    nightFocusMode: document.getElementById('settingNightFocusMode').checked,
    sectionOrder: normalizeSectionOrder(sectionOrderState),
    clockSide: document.getElementById('settingClockSide').value,
    density: document.getElementById('settingDensity').value,
  };
}

async function loadSettings() {
  const settings = await apiRequest('/api/settings');
  fillSettingsForm(settings);
  return settings;
}

async function unlock() {
  try {
    unlockBtn.classList.add('is-busy');
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
  } finally {
    unlockBtn.classList.remove('is-busy');
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
      const action = button.dataset.action;
      setStatus(`Sending ${action}...`);
      await apiRequest('/api/display/power', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      document.querySelectorAll('[data-action]').forEach((btn) => btn.classList.remove('is-active'));
      flashButton(button);
      if (powerStateBadge) powerStateBadge.textContent = action.toUpperCase();
      setStatus(`Display set to ${action}`);
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
    saveSettingsBtn.classList.add('is-busy');
    saveSettingsBtn.classList.remove('is-success');
    saveBtnLabel.textContent = 'Saving…';
    setStatus('Saving settings...');
    const updated = await apiRequest('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(readSettingsForm()),
    });
    fillSettingsForm(updated);
    saveSettingsBtn.classList.add('is-success');
    saveBtnLabel.textContent = 'Saved';
    setStatus('Settings saved');
    window.setTimeout(() => {
      saveSettingsBtn.classList.remove('is-success');
      saveBtnLabel.textContent = 'Save settings';
    }, 1400);
  } catch (error) {
    setStatus(error.message, true);
    saveBtnLabel.textContent = 'Save settings';
  } finally {
    saveSettingsBtn.classList.remove('is-busy');
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
