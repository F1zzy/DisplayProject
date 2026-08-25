const API_BASE = process.env.REACT_APP_API_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${path} (${response.status})`);
  }
  return response.json();
}

export function getLocation() {
  return process.env.REACT_APP_LOCATION || 'Nottingham';
}

export function getCurrentWeather(location = getLocation()) {
  return request(`/api/weather/current?location=${encodeURIComponent(location)}`);
}

export function getForecast(location = getLocation(), days = 7) {
  return request(`/api/weather/forecast?location=${encodeURIComponent(location)}&days=${days}`);
}

export function getHourlyForecast(location = getLocation()) {
  return request(`/api/weather/hourly?location=${encodeURIComponent(location)}`);
}

export function getGlobeWeather() {
  return request('/api/weather/globe');
}

export async function getSatellitePositions() {
  const response = await fetch(`${API_BASE}/api/satellites/positions`);
  const data = await response.json().catch(() => ({
    satellites: [],
    disabled: true,
    attribution: 'Tracking © n2yo.com',
  }));
  if (!response.ok) {
    return {
      satellites: [],
      disabled: Boolean(data?.disabled),
      attribution: data?.attribution || 'Tracking © n2yo.com',
    };
  }
  return {
    satellites: Array.isArray(data?.satellites) ? data.satellites : [],
    disabled: Boolean(data?.disabled),
    attribution: data?.attribution || 'Tracking © n2yo.com',
    fetchedAt: data?.fetchedAt || null,
  };
}

export async function getGlobeLayers() {
  const response = await fetch(`${API_BASE}/api/weather/globe-layers`);
  const data = await response.json().catch(() => ({
    available: false,
    radarUrl: null,
    satelliteUrl: null,
    attribution: '',
  }));
  if (!response.ok) {
    return {
      available: false,
      radarUrl: null,
      satelliteUrl: null,
      attribution: '',
    };
  }
  return data;
}

export function getStocks(symbols = ['AAPL', 'GOOGL', 'MSFT']) {
  return request(`/api/stocks?symbols=${symbols.join(',')}`);
}

export function getNews(category = 'general') {
  return request(`/api/news?category=${category}`);
}

export async function getCalendarEvents(days = 1) {
  const response = await fetch(
    `${API_BASE}/api/calendar/events?days=${encodeURIComponent(days)}`
  );
  const data = await response.json().catch(() => ({ events: [], configured: false }));
  if (response.status === 503) {
    return { configured: false, events: [] };
  }
  if (!response.ok) {
    throw new Error(`API request failed: /api/calendar/events (${response.status})`);
  }
  return {
    configured: data.configured !== false,
    events: data.events || [],
  };
}

export function getNetworkStats() {
  return request('/api/network/stats');
}

export function getF1Standings() {
  return request('/api/f1/standings');
}

export function getSky(location) {
  const query = location ? `?location=${encodeURIComponent(location)}` : '';
  return request(`/api/sky/current${query}`);
}

export async function getSpotifyNow() {
  const response = await fetch(`${API_BASE}/api/spotify/now`);
  const data = await response.json().catch(() => ({
    configured: false,
    track: null,
    topTracks: [],
    playing: false,
  }));
  if (response.status === 503) {
    return {
      configured: false,
      track: null,
      topTracks: [],
      playing: false,
    };
  }
  if (!response.ok) {
    throw new Error(`API request failed: /api/spotify/now (${response.status})`);
  }
  return {
    configured: data.configured !== false,
    playing: Boolean(data.playing),
    track: data.track || null,
    progressMs: data.progressMs ?? null,
    topTracks: Array.isArray(data.topTracks) ? data.topTracks : [],
    fetchedAt: data.fetchedAt || null,
  };
}

export function getSettings() {
  return request('/api/settings');
}

/** Fire-and-forget widget view beacon for analytics (auto-rotation). */
export function reportWidgetView(widget, source = 'auto') {
  if (!widget) return;
  void fetch(`${API_BASE}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'widget_view', widget, source }),
  }).catch(() => {});
}

export function weatherIconUrl(iconPath) {
  if (!iconPath) return '';
  return iconPath.startsWith('http') ? iconPath : `https:${iconPath}`;
}
