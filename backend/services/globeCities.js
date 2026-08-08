/**
 * Curated globe city catalog. IDs are stable settings keys.
 * Keep the list focused — remote toggles which ones appear on the widget.
 */
/** countryIso: ISO 3166-1 numeric (matches public/globe/countries-highlight.json). */
const GLOBE_CITY_CATALOG = [
  { id: 'london', name: 'London', country: 'UK', countryIso: '826', lat: 51.5074, lon: -0.1278, query: 'London' },
  { id: 'new-york', name: 'New York', country: 'USA', countryIso: '840', lat: 40.7128, lon: -74.006, query: 'New York' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', countryIso: '392', lat: 35.6762, lon: 139.6503, query: 'Tokyo' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', countryIso: '036', lat: -33.8688, lon: 151.2093, query: 'Sydney' },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria', countryIso: '566', lat: 6.5244, lon: 3.3792, query: 'Lagos' },
  { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', countryIso: '076', lat: -23.5505, lon: -46.6333, query: 'Sao Paulo' },
  { id: 'dubai', name: 'Dubai', country: 'UAE', countryIso: '784', lat: 25.2048, lon: 55.2708, query: 'Dubai' },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', countryIso: '702', lat: 1.3521, lon: 103.8198, query: 'Singapore' },
  { id: 'paris', name: 'Paris', country: 'France', countryIso: '250', lat: 48.8566, lon: 2.3522, query: 'Paris' },
  { id: 'berlin', name: 'Berlin', country: 'Germany', countryIso: '276', lat: 52.52, lon: 13.405, query: 'Berlin' },
  { id: 'mumbai', name: 'Mumbai', country: 'India', countryIso: '356', lat: 19.076, lon: 72.8777, query: 'Mumbai' },
  { id: 'hong-kong', name: 'Hong Kong', country: 'China', countryIso: '344', lat: 22.3193, lon: 114.1694, query: 'Hong Kong' },
  { id: 'toronto', name: 'Toronto', country: 'Canada', countryIso: '124', lat: 43.6532, lon: -79.3832, query: 'Toronto' },
  { id: 'mexico-city', name: 'Mexico City', country: 'Mexico', countryIso: '484', lat: 19.4326, lon: -99.1332, query: 'Mexico City' },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', countryIso: '818', lat: 30.0444, lon: 31.2357, query: 'Cairo' },
  { id: 'seoul', name: 'Seoul', country: 'South Korea', countryIso: '410', lat: 37.5665, lon: 126.978, query: 'Seoul' },
];

const GLOBE_CITY_IDS = GLOBE_CITY_CATALOG.map((city) => city.id);

const DEFAULT_GLOBE_CITIES = [
  'london',
  'new-york',
  'tokyo',
  'sydney',
  'lagos',
  'sao-paulo',
  'dubai',
  'singapore',
];

const byId = new Map(GLOBE_CITY_CATALOG.map((city) => [city.id, city]));

function resolveGlobeCities(ids) {
  const list = Array.isArray(ids) ? ids : DEFAULT_GLOBE_CITIES;
  const seen = new Set();
  const result = [];
  for (const id of list) {
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(byId.get(id));
  }
  if (result.length === 0) {
    return DEFAULT_GLOBE_CITIES.map((id) => byId.get(id)).filter(Boolean);
  }
  return result;
}

function sanitizeGlobeCityIds(input) {
  if (!Array.isArray(input)) return [...DEFAULT_GLOBE_CITIES];
  const seen = new Set();
  const result = [];
  for (const id of input) {
    if (GLOBE_CITY_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result.length > 0 ? result : [...DEFAULT_GLOBE_CITIES];
}

module.exports = {
  GLOBE_CITY_CATALOG,
  GLOBE_CITY_IDS,
  DEFAULT_GLOBE_CITIES,
  resolveGlobeCities,
  sanitizeGlobeCityIds,
};
