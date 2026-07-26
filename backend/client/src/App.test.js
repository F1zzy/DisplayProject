import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./api/client', () => ({
  getLocation: () => 'Nottingham',
  getSettings: () =>
    Promise.resolve({
      location: 'Nottingham',
      stockSymbols: ['AAPL', 'GOOGL', 'MSFT'],
      widgetRotationMs: 120000,
      enabledWidgets: ['stock', 'news', 'timetable', 'network'],
      calendarDays: 1,
      newsGeneral: true,
      newsTechnology: true,
      forecastDays: 3,
      backgroundMode: 'default',
      backgroundColor: '#101115',
      backgroundImage: '',
    }),
  getCurrentWeather: () =>
    Promise.resolve({ temperature: 18, humidity: 65, iconUrl: '//cdn.weatherapi.com/icon.png' }),
  getForecast: () => Promise.resolve([]),
  getHourlyForecast: () => Promise.resolve([]),
  getStocks: () => Promise.resolve({ symbols: [], data: [] }),
  getNews: () => Promise.resolve([]),
  getCalendarEvents: () => Promise.resolve({ events: [], configured: false }),
  getNetworkStats: () =>
    Promise.resolve({
      online: true,
      latencyMs: 12,
      checkedAt: new Date().toISOString(),
      lastOnlineAt: new Date().toISOString(),
      interface: null,
      rxBps: null,
      txBps: null,
    }),
  getSky: () =>
    Promise.resolve({
      location: 'Nottingham',
      chartUrl: null,
      bodies: [],
      configured: { chart: false, planets: true },
      errors: {},
    }),
  getSpotifyNow: () =>
    Promise.resolve({
      configured: false,
      playing: false,
      track: null,
      topTracks: [],
    }),
  getF1Standings: () =>
    Promise.resolve({
      season: '2026',
      round: 11,
      drivers: [],
      constructors: [],
      nextRace: null,
      live: { active: false, order: [] },
    }),
  weatherIconUrl: (icon) => (icon.startsWith('http') ? icon : `https:${icon}`),
}));

beforeEach(() => {
  global.WebSocket = class {
    close() {}
  };
});

test('renders dashboard with weather stats', async () => {
  render(<App />);
  expect(await screen.findByText(/humidity/i)).toBeInTheDocument();
});
