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
  f1: 'Formula 1',
  globe: 'World',
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

function replayAnimation(el) {
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function pulseElement(el, className = 'is-pulse') {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function applyUnlockUi(unlocked) {
  document.body.classList.toggle('is-unlocked', unlocked);
  statusPill.textContent = unlocked ? 'UNLOCKED' : 'LOCKED';
  pulseElement(statusPill, 'is-pill-flash');

  if (unlocked) {
    lockSection.classList.add('is-exiting');
    window.setTimeout(() => {
      lockSection.hidden = true;
      lockSection.classList.remove('is-exiting');
      controlsEl.hidden = false;
      lockBtn.hidden = false;
      controlsEl.classList.add('is-entering');
      lockBtn.classList.add('is-entering');
      setRemoteView('control', { animate: true });
      controlsEl.querySelectorAll('.anim-in').forEach(replayAnimation);
      window.setTimeout(() => {
        controlsEl.classList.remove('is-entering');
        lockBtn.classList.remove('is-entering');
      }, 480);
    }, 220);
    setStatus('Unlocked');
  } else {
    controlsEl.hidden = true;
    lockBtn.hidden = true;
    lockSection.hidden = false;
    lockSection.classList.add('is-entering');
    replayAnimation(lockSection);
    window.setTimeout(() => lockSection.classList.remove('is-entering'), 420);
    setStatus('Enter API key to unlock');
  }
}

function syncNavIndicator(view) {
  const nav = document.querySelector('.remote-nav');
  if (!nav) return;
  nav.dataset.activeView = view;
}

const REMOTE_VIEW_ORDER = ['control', 'analytics', 'network', 'settings'];

function setRemoteView(view, { animate = true } = {}) {
  const buttons = document.querySelectorAll('[data-remote-view]');
  const panels = Array.from(document.querySelectorAll('[data-view-panel]'));
  const current = panels.find((panel) => panel.classList.contains('is-active'));
  const next = panels.find((panel) => panel.dataset.viewPanel === view);
  if (!next) return;

  const sameView = current === next;
  const currentView = current?.dataset.viewPanel || 'control';
  const fromIdx = REMOTE_VIEW_ORDER.indexOf(currentView);
  const toIdx = REMOTE_VIEW_ORDER.indexOf(view);
  const direction = toIdx >= fromIdx ? 'forward' : 'back';

  buttons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.remoteView === view);
  });
  syncNavIndicator(view);

  if (sameView) {
    next.hidden = false;
    next.classList.add('is-active');
    if (view === 'analytics') {
      loadAnalytics().catch((error) => setStatus(error.message, true));
    }
    if (view === 'network') {
      loadNetwork().catch((error) => setStatus(error.message, true));
    }
    return;
  }

  panels.forEach((panel) => {
    panel.classList.remove(
      'is-active',
      'view-enter-forward',
      'view-enter-back',
      'view-exit-forward',
      'view-exit-back'
    );
    if (panel === next) {
      panel.hidden = false;
      panel.classList.add('is-active');
      if (animate) {
        panel.classList.add(direction === 'forward' ? 'view-enter-forward' : 'view-enter-back');
        panel.querySelectorAll('.anim-in').forEach(replayAnimation);
      }
    } else if (panel === current && animate) {
      panel.hidden = false;
      panel.classList.add(direction === 'forward' ? 'view-exit-forward' : 'view-exit-back');
      window.setTimeout(() => {
        if (!panel.classList.contains('is-active')) {
          panel.hidden = true;
          panel.classList.remove('view-exit-forward', 'view-exit-back');
        }
      }, 280);
    } else {
      panel.hidden = true;
    }
  });

  if (view === 'analytics') {
    loadAnalytics().catch((error) => setStatus(error.message, true));
  }
  if (view === 'network') {
    loadNetwork().catch((error) => setStatus(error.message, true));
  }
}

function formatHourLabel(hour) {
  const h = Number(hour);
  if (Number.isNaN(h)) return '—';
  const start = String(h).padStart(2, '0');
  const end = String((h + 1) % 24).padStart(2, '0');
  return `${start}:00–${end}:00`;
}

function setAnalyticsText(selector, text) {
  const el = document.querySelector(`[data-analytics="${selector}"]`);
  if (el) el.textContent = text;
}

async function loadAnalytics() {
  const badge = document.getElementById('analyticsBadge');
  const hint = document.getElementById('analyticsHint');
  const chartsAlreadyMounted = Boolean(document.querySelector('script[data-analytics-charts]'));
  const chartsReady = ensureAnalyticsChartsLoaded().catch(() => null);
  const data = await apiRequest('/api/analytics/summary');

  const most = data.mostViewedWidget;
  if (most?.key) {
    setAnalyticsText('mostViewed', WIDGET_LABELS[most.key] || most.key);
    setAnalyticsText('mostViewedMeta', `${most.views} view${most.views === 1 ? '' : 's'}`);
  } else {
    setAnalyticsText('mostViewed', 'No data yet');
    setAnalyticsText('mostViewedMeta', '');
  }

  const busy = data.busiestHour;
  if (busy && busy.hour !== undefined && busy.hour !== null) {
    setAnalyticsText('busiestHour', formatHourLabel(busy.hour));
    setAnalyticsText('busiestHourMeta', `${busy.events} event${busy.events === 1 ? '' : 's'}`);
  } else {
    setAnalyticsText('busiestHour', 'No data yet');
    setAnalyticsText('busiestHourMeta', '');
  }

  const slow = data.slowestApi;
  if (slow?.path) {
    setAnalyticsText('slowestApi', slow.path);
    setAnalyticsText(
      'slowestApiMeta',
      `${Math.round(slow.avgMs)} ms avg · ${slow.samples} sample${slow.samples === 1 ? '' : 's'}`
    );
  } else {
    setAnalyticsText('slowestApi', 'No data yet');
    setAnalyticsText('slowestApiMeta', '');
  }

  if (badge) {
    badge.textContent = data.available === false ? 'OFFLINE' : '24H';
  }
  if (hint) {
    const totals = data.totals || {};
    hint.textContent =
      data.available === false
        ? 'Analytics service unreachable. Start it with: cd analytics && go run ./cmd/analytics'
        : `Last ${data.windowHours || 24}h · ${totals.apiCalls || 0} API calls · ${totals.widgetViews || 0} widget views`;
  }

  await chartsReady;
  // First mount fetches on its own; later visits/refreshes re-fetch via this event.
  if (chartsAlreadyMounted) {
    window.dispatchEvent(new CustomEvent('analytics:refresh'));
  }
}

let analyticsChartsPromise = null;

function ensureAnalyticsChartsLoaded() {
  if (analyticsChartsPromise) return analyticsChartsPromise;
  if (document.querySelector('script[data-analytics-charts]')) {
    analyticsChartsPromise = Promise.resolve();
    return analyticsChartsPromise;
  }

  analyticsChartsPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/remote/analytics-app/assets/analytics.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/remote/analytics-app/assets/analytics.js';
    script.dataset.analyticsCharts = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load analytics charts'));
    document.body.appendChild(script);
  }).catch((error) => {
    analyticsChartsPromise = null;
    throw error;
  });

  return analyticsChartsPromise;
}

function formatNetworkRate(bps) {
  if (bps == null || Number.isNaN(Number(bps))) return '—';
  const n = Number(bps);
  if (n < 1024) return `${n} B/s`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB/s`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB/s`;
}

function setNetworkText(selector, text) {
  const el = document.querySelector(`[data-network="${selector}"]`);
  if (el) el.textContent = text;
}

async function loadNetwork() {
  const badge = document.getElementById('networkBadge');
  const hint = document.getElementById('networkHint');
  const chartsAlreadyMounted = Boolean(document.querySelector('script[data-network-charts]'));
  const chartsReady = ensureNetworkChartsLoaded().catch(() => null);
  const data = await apiRequest('/api/network/summary');

  const online = data.online === true;
  setNetworkText('status', online ? 'Online' : 'Offline');
  setNetworkText(
    'statusMeta',
    data.latencyMs != null ? `${data.latencyMs} ms probe` : 'Latency unavailable'
  );

  setNetworkText('download', formatNetworkRate(data.rxBps));
  setNetworkText(
    'downloadMeta',
    data.txBps != null ? `Upload ${formatNetworkRate(data.txBps)}` : 'Upload —'
  );

  if (data.publicIp) {
    setNetworkText('publicIp', data.publicIp);
    setNetworkText(
      'publicIpMeta',
      data.interface ? `Iface ${data.interface}${data.ipv4 ? ` · ${data.ipv4}` : ''}` : 'Outbound identity'
    );
  } else if (data.interface) {
    setNetworkText('publicIp', data.interface);
    setNetworkText('publicIpMeta', data.ipv4 ? `Local ${data.ipv4}` : 'Public IP unavailable');
  } else {
    setNetworkText('publicIp', 'Unavailable');
    setNetworkText('publicIpMeta', 'Host details not available');
  }

  if (badge) {
    badge.textContent = data.available === false ? 'OFFLINE' : online ? 'LIVE' : 'DOWN';
  }
  if (hint) {
    hint.textContent =
      data.available === false
        ? 'Network service unreachable. Start it with: cd network && go run ./cmd/network'
        : `Cached ~15s · ${data.history?.length || 0}/${data.windowSamples || 12} history samples`;
  }

  await chartsReady;
  if (chartsAlreadyMounted) {
    window.dispatchEvent(new CustomEvent('network:refresh'));
  }
}

let networkChartsPromise = null;

function ensureNetworkChartsLoaded() {
  if (networkChartsPromise) return networkChartsPromise;
  if (document.querySelector('script[data-network-charts]')) {
    networkChartsPromise = Promise.resolve();
    return networkChartsPromise;
  }

  networkChartsPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/remote/network-app/assets/network.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/remote/network-app/assets/network.js';
    script.dataset.networkCharts = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load network charts'));
    document.body.appendChild(script);
  }).catch((error) => {
    networkChartsPromise = null;
    throw error;
  });

  return networkChartsPromise;
}

function bindRemoteNavigation() {
  syncNavIndicator('control');

  document.querySelectorAll('[data-remote-view]').forEach((button) => {
    button.addEventListener('click', () => {
      setRemoteView(button.dataset.remoteView);
    });
  });

  const analyticsRefreshBtn = document.getElementById('analyticsRefreshBtn');
  if (analyticsRefreshBtn) {
    analyticsRefreshBtn.addEventListener('click', async () => {
      flashButton(analyticsRefreshBtn);
      try {
        await loadAnalytics();
        setStatus('Analytics refreshed');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  }

  const networkRefreshBtn = document.getElementById('networkRefreshBtn');
  if (networkRefreshBtn) {
    networkRefreshBtn.addEventListener('click', async () => {
      flashButton(networkRefreshBtn);
      try {
        await loadNetwork();
        setStatus('Network refreshed');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  }

  // Keep settings groups tidy: opening one closes the others.
  document.querySelectorAll('.settings-group').forEach((group) => {
    group.addEventListener('toggle', () => {
      if (!group.open) return;
      group.classList.add('is-opening');
      window.setTimeout(() => group.classList.remove('is-opening'), 360);
      document.querySelectorAll('.settings-group').forEach((other) => {
        if (other !== group) other.open = false;
      });
    });
  });
}

function flashButton(button) {
  if (!button) return;
  button.classList.remove('is-flash', 'is-active');
  void button.offsetWidth;
  button.classList.add('is-flash', 'is-active');
  window.setTimeout(() => button.classList.remove('is-active'), 450);
}

function flashPowerBadge() {
  pulseElement(powerStateBadge, 'is-badge-flash');
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
    if (powerStateBadge && state.power) {
      const presence = state.presence;
      let label = String(state.power).toUpperCase();
      if (presence && presence.enabled) {
        if (presence.home === true) label = `${label} · HOME`;
        else if (presence.home === false) label = `${label} · AWAY`;
      }
      powerStateBadge.textContent = label;
    }
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

  widgetButtonsEl.querySelectorAll('.chip, .pin-row').forEach((el, index) => {
    el.classList.add('chip-enter');
    el.style.setProperty('--chip-delay', `${index * 45}ms`);
  });
}

function syncBackgroundFields() {
  const mode = document.getElementById('settingBackgroundMode').value;
  document.getElementById('settingBackgroundColorRow').hidden = mode !== 'color';
  document.getElementById('settingBackgroundImageRow').hidden = mode !== 'image';
}

function syncColorSchemeFields() {
  const scheme = document.getElementById('settingColorScheme').value;
  const row = document.getElementById('settingCustomColors');
  if (row) row.hidden = scheme !== 'custom';
}

function syncCustomSurfaceFields() {
  const pairs = [
    ['settingCustomBgApp', 'settingCustomBgAppTransparent'],
    ['settingCustomBgPanel', 'settingCustomBgPanelTransparent'],
    ['settingCustomBgCard', 'settingCustomBgCardTransparent'],
  ];
  pairs.forEach(([colorId, checkId]) => {
    const colorInput = document.getElementById(colorId);
    const check = document.getElementById(checkId);
    if (!colorInput || !check) return;
    colorInput.disabled = check.checked;
  });
}

function fillCustomSurface(colorId, checkId, value, fallbackHex) {
  const colorInput = document.getElementById(colorId);
  const check = document.getElementById(checkId);
  const transparent = String(value || '').toLowerCase() === 'transparent';
  if (check) check.checked = transparent;
  if (colorInput) {
    colorInput.value = transparent ? fallbackHex : value || fallbackHex;
    colorInput.disabled = transparent;
  }
}

function readCustomSurface(colorId, checkId) {
  const check = document.getElementById(checkId);
  if (check && check.checked) return 'transparent';
  return document.getElementById(colorId).value;
}

function applyAppearanceFromFormOrSettings(settings) {
  if (typeof applyRemoteAppearance === 'function') {
    applyRemoteAppearance(settings);
  }
}

function syncNightFocusFields() {
  const enabled = document.getElementById('settingNightFocusMode').checked;
  const when = document.getElementById('settingNightFocusWhen').value;
  const whenRow = document.getElementById('settingNightFocusWhenRow');
  const startRow = document.getElementById('settingNightFocusStartRow');
  const endRow = document.getElementById('settingNightFocusEndRow');
  if (whenRow) whenRow.hidden = !enabled;
  const showCustom = enabled && when === 'custom';
  if (startRow) startRow.hidden = !showCustom;
  if (endRow) endRow.hidden = !showCustom;
}

function syncBrightnessLabel() {
  const input = document.getElementById('settingDisplayBrightness');
  const label = document.getElementById('settingBrightnessValue');
  if (input && label) label.textContent = String(input.value);
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
  document.getElementById('settingStockChartMode').value = settings.stockChartMode || 'line';
  document.getElementById('settingRotation').value = Math.round((settings.widgetRotationMs || 0) / 1000);
  document.getElementById('settingCalendarDays').value = settings.calendarDays ?? 1;
  document.getElementById('settingForecastDays').value = settings.forecastDays ?? 3;
  document.getElementById('settingPresenceEnabled').checked = settings.presenceEnabled === true;
  document.getElementById('settingPresenceHost').value = settings.presenceHost || '';
  document.getElementById('settingPresenceAwayAfter').value = Math.round(
    (settings.presenceAwayAfterMs != null ? settings.presenceAwayAfterMs : 90000) / 1000
  );
  document.getElementById('settingNewsGeneral').checked = settings.newsGeneral !== false;
  document.getElementById('settingNewsTechnology').checked = settings.newsTechnology !== false;

  const globeCities = new Set(settings.globeCities || []);
  document.querySelectorAll('input[name="globeCity"]').forEach((input) => {
    input.checked = globeCities.size === 0 || globeCities.has(input.value);
  });
  document.getElementById('settingGlobeLayers').value = settings.globeLayers || 'both';
  document.getElementById('settingBackgroundMode').value = settings.backgroundMode || 'default';
  document.getElementById('settingBackgroundColor').value = settings.backgroundColor || '#101115';
  document.getElementById('settingBackgroundImage').value = settings.backgroundImage || '';
  document.getElementById('settingColorScheme').value = settings.colorScheme || 'orange-dark';
  document.getElementById('settingCustomAccent').value = settings.customAccent || '#ff6a1a';
  fillCustomSurface('settingCustomBgApp', 'settingCustomBgAppTransparent', settings.customBgApp, '#101115');
  fillCustomSurface(
    'settingCustomBgPanel',
    'settingCustomBgPanelTransparent',
    settings.customBgPanel,
    '#1a1c21'
  );
  fillCustomSurface(
    'settingCustomBgCard',
    'settingCustomBgCardTransparent',
    settings.customBgCard,
    '#26282e'
  );
  document.getElementById('settingFontPreset').value = settings.fontPreset || 'nothing';
  document.getElementById('settingClockAnimation').value = settings.clockAnimation || 'off';
  document.getElementById('settingClockSize').value = settings.clockSize || 'large';
  document.getElementById('settingClockFontSize').value = settings.clockFontSize || 'lg';
  document.getElementById('settingWeatherAtmosphere').checked = settings.weatherAtmosphere === true;
  document.getElementById('settingNightFocusMode').checked = settings.nightFocusMode === true;
  document.getElementById('settingSpotifyLyricsBackground').checked =
    settings.spotifyLyricsBackground !== false;
  document.getElementById('settingNightFocusWhen').value = settings.nightFocusWhen || 'auto';
  document.getElementById('settingNightFocusStartHour').value =
    settings.nightFocusStartHour != null ? settings.nightFocusStartHour : 20;
  document.getElementById('settingNightFocusEndHour').value =
    settings.nightFocusEndHour != null ? settings.nightFocusEndHour : 6;
  document.getElementById('settingDisplayBrightness').value =
    settings.displayBrightness != null ? settings.displayBrightness : 100;
  document.getElementById('settingClockSide').value = settings.clockSide || 'left';
  document.getElementById('settingDensity').value = settings.density || 'comfortable';
  syncBackgroundFields();
  syncColorSchemeFields();
  syncNightFocusFields();
  syncBrightnessLabel();
  applyAppearanceFromFormOrSettings(settings);

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
    stockChartMode: document.getElementById('settingStockChartMode').value || 'line',
    widgetRotationMs: Number.isNaN(rotationSeconds) ? 120000 : rotationSeconds * 1000,
    enabledWidgets,
    calendarDays: parseInt(document.getElementById('settingCalendarDays').value, 10) || 1,
    forecastDays: parseInt(document.getElementById('settingForecastDays').value, 10) || 3,
    presenceEnabled: document.getElementById('settingPresenceEnabled').checked,
    presenceHost: document.getElementById('settingPresenceHost').value.trim(),
    presenceAwayAfterMs:
      (parseInt(document.getElementById('settingPresenceAwayAfter').value, 10) || 90) * 1000,
    newsGeneral: document.getElementById('settingNewsGeneral').checked,
    newsTechnology: document.getElementById('settingNewsTechnology').checked,
    globeCities: Array.from(document.querySelectorAll('input[name="globeCity"]:checked')).map(
      (input) => input.value
    ),
    globeLayers: document.getElementById('settingGlobeLayers').value || 'both',
    backgroundMode: document.getElementById('settingBackgroundMode').value,
    backgroundColor: document.getElementById('settingBackgroundColor').value,
    backgroundImage: document.getElementById('settingBackgroundImage').value.trim(),
    colorScheme: document.getElementById('settingColorScheme').value,
    customAccent: document.getElementById('settingCustomAccent').value,
    customBgApp: readCustomSurface('settingCustomBgApp', 'settingCustomBgAppTransparent'),
    customBgPanel: readCustomSurface('settingCustomBgPanel', 'settingCustomBgPanelTransparent'),
    customBgCard: readCustomSurface('settingCustomBgCard', 'settingCustomBgCardTransparent'),
    fontPreset: document.getElementById('settingFontPreset').value,
    clockAnimation: document.getElementById('settingClockAnimation').value,
    clockSize: document.getElementById('settingClockSize').value,
    clockFontSize: document.getElementById('settingClockFontSize').value,
    weatherAtmosphere: document.getElementById('settingWeatherAtmosphere').checked,
    nightFocusMode: document.getElementById('settingNightFocusMode').checked,
    spotifyLyricsBackground: document.getElementById('settingSpotifyLyricsBackground').checked,
    nightFocusWhen: document.getElementById('settingNightFocusWhen').value,
    nightFocusStartHour: parseInt(document.getElementById('settingNightFocusStartHour').value, 10),
    nightFocusEndHour: parseInt(document.getElementById('settingNightFocusEndHour').value, 10),
    displayBrightness: parseInt(document.getElementById('settingDisplayBrightness').value, 10),
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
      await refreshDisplayState();
      if (powerStateBadge) {
        flashPowerBadge();
      }
      setStatus(`Display set to ${action}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

unlockBtn.addEventListener('click', unlock);
lockBtn.addEventListener('click', lock);
bindRemoteNavigation();
document.getElementById('settingBackgroundMode').addEventListener('change', syncBackgroundFields);
document.getElementById('settingColorScheme').addEventListener('change', syncColorSchemeFields);
['settingCustomBgAppTransparent', 'settingCustomBgPanelTransparent', 'settingCustomBgCardTransparent'].forEach(
  (id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', syncCustomSurfaceFields);
  }
);
document.getElementById('settingNightFocusMode').addEventListener('change', syncNightFocusFields);
document.getElementById('settingNightFocusWhen').addEventListener('change', syncNightFocusFields);
document.getElementById('settingDisplayBrightness').addEventListener('input', syncBrightnessLabel);

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
    pulseElement(saveSettingsBtn, 'is-success-pop');
    saveBtnLabel.textContent = 'Saved';
    setStatus('Settings saved');
    window.setTimeout(() => {
      saveSettingsBtn.classList.remove('is-success', 'is-success-pop');
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
  // Public settings — restyle remote to match dashboard even while locked
  fetch(`${serverUrlInput.value.replace(/\/$/, '')}/api/settings`)
    .then((res) => (res.ok ? res.json() : null))
    .then((settings) => {
      if (settings) applyAppearanceFromFormOrSettings(settings);
    })
    .catch(() => {});
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/remote/sw.js').catch(() => {});
}
