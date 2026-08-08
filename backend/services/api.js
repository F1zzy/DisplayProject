require('dotenv').config();

const LOCATION = process.env.LOCATION || 'Nottingham';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const STOCK_API_KEY = process.env.STOCK_API_KEY;
const CONTROL_API_KEY = process.env.CONTROL_API_KEY || 'change-me';

const WEATHER_BASE = 'https://api.weatherapi.com/v1';
const STOCK_TTL_MS = 15 * 60 * 1000;
const WEATHER_TTL_MS = 10 * 60 * 1000;
const GLOBE_TTL_MS = 15 * 60 * 1000;
const NEWS_TTL_MS = 15 * 60 * 1000;
const STOCK_FETCH_DELAY_MS = 13000;

const cache = require('./cache');
const settings = require('./settings');
const { GLOBE_CITY_CATALOG, resolveGlobeCities } = require('./globeCities');

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  return response.json();
}

function getLocation(req) {
  if (req?.query?.location) {
    return req.query.location;
  }
  return settings.getSettings().location || LOCATION;
}

async function getCurrentWeather(location) {
  const cacheKey = `weather:current:${location}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(
    `${WEATHER_BASE}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=no`
  );

  const result = {
    temperature: data.current.temp_c,
    humidity: data.current.humidity,
    iconUrl: data.current.condition.icon,
    condition: data.current.condition.text,
    conditionCode: data.current.condition.code,
    isDay: data.current.is_day === 1,
  };

  cache.set(cacheKey, result, WEATHER_TTL_MS);
  return result;
}

async function getLocationCoordinates(location) {
  const cacheKey = `weather:coords:${location}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(
    `${WEATHER_BASE}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=no`
  );

  const result = {
    name: data.location?.name || location,
    region: data.location?.region || null,
    country: data.location?.country || null,
    latitude: data.location?.lat,
    longitude: data.location?.lon,
  };

  if (result.latitude == null || result.longitude == null) {
    throw new Error(`Unable to resolve coordinates for ${location}`);
  }

  cache.set(cacheKey, result, WEATHER_TTL_MS);
  return result;
}

async function getForecast(location, days = 7) {
  const cacheKey = `weather:forecast:${location}:${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(
    `${WEATHER_BASE}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(location)}&days=${days}`
  );

  cache.set(cacheKey, data.forecast.forecastday, WEATHER_TTL_MS);
  return data.forecast.forecastday;
}

async function getHourlyForecast(location) {
  const cacheKey = `weather:hourly:${location}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(
    `${WEATHER_BASE}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(location)}&days=2`
  );

  const now = new Date();
  const hours = [];

  for (let offset = -2; offset < 10; offset++) {
    const target = new Date(now);
    target.setHours(now.getHours() + offset, 0, 0, 0);

    const dayIndex = target.getDate() === now.getDate() ? 0 : 1;
    const day = data.forecast.forecastday[dayIndex];
    if (!day) continue;

    const hourData = day.hour[target.getHours()];
    if (hourData) hours.push(hourData);
  }

  cache.set(cacheKey, hours, WEATHER_TTL_MS);
  return hours;
}

async function fetchGlobeCityWeather(city) {
  const cacheKey = `weather:globe:${city.id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      country: city.country,
      countryIso: city.countryIso,
      name: city.name,
      lat: city.lat,
      lon: city.lon,
    };
  }

  const data = await fetchJson(
    `${WEATHER_BASE}/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city.query)}&aqi=no`
  );

  const result = {
    id: city.id,
    name: city.name,
    country: city.country,
    countryIso: city.countryIso,
    lat: city.lat,
    lon: city.lon,
    temperature: data.current.temp_c,
    humidity: data.current.humidity,
    windKph: data.current.wind_kph,
    condition: data.current.condition?.text || '',
    iconUrl: data.current.condition?.icon || '',
  };

  cache.set(cacheKey, result, GLOBE_TTL_MS);
  return result;
}

/**
 * Current weather for selected globe cities (from settings.globeCities).
 * Soft-fails per city so partial results still render.
 */
async function getGlobeWeather(cityIds) {
  const selected =
    cityIds != null
      ? resolveGlobeCities(cityIds)
      : resolveGlobeCities(settings.getSettings().globeCities);

  const settled = await Promise.all(
    selected.map(async (city) => {
      try {
        return await fetchGlobeCityWeather(city);
      } catch (error) {
        console.error(`Globe weather failed for ${city.id}:`, error.message);
        return null;
      }
    })
  );

  return { cities: settled.filter(Boolean) };
}

async function getStock(symbol) {
  const cacheKey = `stock:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${STOCK_API_KEY}`
  );

  const series = data['Time Series (Daily)'];
  if (!series) {
    throw new Error(data.Note || data.Information || `No data for ${symbol}`);
  }

  cache.set(cacheKey, series, STOCK_TTL_MS);
  return series;
}

async function getStocksSequential(symbols) {
  const results = [];

  for (let i = 0; i < symbols.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, STOCK_FETCH_DELAY_MS));
    }
    try {
      results.push(await getStock(symbols[i]));
    } catch (error) {
      console.error(`Stock fetch failed for ${symbols[i]}:`, error.message);
      results.push(null);
    }
  }

  return results;
}

async function getNews(category) {
  const cacheKey = `news:${category}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url =
    category === 'general'
      ? `https://newsapi.org/v2/top-headlines?sources=bbc-news&apiKey=${NEWS_API_KEY}`
      : `https://newsapi.org/v2/top-headlines?q=technology&apiKey=${NEWS_API_KEY}`;

  const data = await fetchJson(url);
  const articles = data.articles || [];

  cache.set(cacheKey, articles, NEWS_TTL_MS);
  return articles;
}

function verifyControlKey(req) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  return key === CONTROL_API_KEY;
}

module.exports = {
  LOCATION,
  CONTROL_API_KEY,
  GLOBE_CITIES: GLOBE_CITY_CATALOG,
  getLocation,
  getCurrentWeather,
  getLocationCoordinates,
  getForecast,
  getHourlyForecast,
  getGlobeWeather,
  getStock,
  getStocksSequential,
  getNews,
  verifyControlKey,
};
