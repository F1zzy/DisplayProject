import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./api/client', () => ({
  getLocation: () => 'Nottingham',
  getCurrentWeather: () =>
    Promise.resolve({ temperature: 18, humidity: 65, iconUrl: '//cdn.weatherapi.com/icon.png' }),
  getForecast: () => Promise.resolve([]),
  getHourlyForecast: () => Promise.resolve([]),
  getStocks: () => Promise.resolve({ symbols: [], data: [] }),
  getNews: () => Promise.resolve([]),
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
