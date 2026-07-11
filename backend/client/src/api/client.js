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

export function getStocks(symbols = ['AAPL', 'GOOGL', 'MSFT']) {
  return request(`/api/stocks?symbols=${symbols.join(',')}`);
}

export function getNews(category = 'general') {
  return request(`/api/news?category=${category}`);
}

export function weatherIconUrl(iconPath) {
  if (!iconPath) return '';
  return iconPath.startsWith('http') ? iconPath : `https:${iconPath}`;
}
