import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { WeatherProvider, useWeather } from './WeatherContext';
import { SettingsProvider } from './SettingsContext';

const mockGetCurrentWeather = jest.fn();
const mockGetForecast = jest.fn();
const mockGetHourlyForecast = jest.fn();
const mockGetSettings = jest.fn();

jest.mock('../api/client', () => ({
  getCurrentWeather: (...args) => mockGetCurrentWeather(...args),
  getForecast: (...args) => mockGetForecast(...args),
  getHourlyForecast: (...args) => mockGetHourlyForecast(...args),
  getSettings: (...args) => mockGetSettings(...args),
  getLocation: () => 'Nottingham',
}));

function WeatherProbe() {
  const { current, loading } = useWeather();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="temp">{current?.temperature ?? 'none'}</span>
    </div>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGetSettings.mockResolvedValue({
    location: 'Nottingham',
    forecastDays: 3,
  });
  mockGetCurrentWeather.mockResolvedValue({ temperature: 18, humidity: 50 });
  mockGetForecast.mockResolvedValue([]);
  mockGetHourlyForecast.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('loads weather and refreshes on interval', async () => {
  mockGetCurrentWeather
    .mockResolvedValueOnce({ temperature: 18, humidity: 50 })
    .mockResolvedValueOnce({ temperature: 21, humidity: 40 });

  render(
    <SettingsProvider>
      <WeatherProvider>
        <WeatherProbe />
      </WeatherProvider>
    </SettingsProvider>
  );

  await waitFor(() => expect(screen.getByTestId('temp')).toHaveTextContent('18'));
  expect(mockGetCurrentWeather).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(12 * 60 * 1000);
  });

  await waitFor(() => expect(screen.getByTestId('temp')).toHaveTextContent('21'));
  expect(mockGetCurrentWeather).toHaveBeenCalledTimes(2);
});
