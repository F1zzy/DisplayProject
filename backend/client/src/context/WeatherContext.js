import { createContext, useCallback, useContext } from 'react';
import { getCurrentWeather, getForecast, getHourlyForecast } from '../api/client';
import { useSettings } from './SettingsContext';
import { usePollingFetch } from '../hooks/usePollingFetch';

const WeatherContext = createContext(null);
const WEATHER_POLL_MS = 12 * 60 * 1000;

export function WeatherProvider({ children }) {
  const { settings } = useSettings();
  const location = settings.location;
  const forecastDays = settings.forecastDays;

  const fetchWeather = useCallback(async () => {
    const [currentData, forecastData, hourlyData] = await Promise.all([
      getCurrentWeather(location),
      getForecast(location, forecastDays),
      getHourlyForecast(location),
    ]);
    return {
      current: currentData,
      forecast: forecastData,
      hourly: hourlyData,
    };
  }, [location, forecastDays]);

  const { data, loading, error } = usePollingFetch(fetchWeather, {
    intervalMs: WEATHER_POLL_MS,
    deps: [location, forecastDays],
  });

  return (
    <WeatherContext.Provider
      value={{
        current: data?.current ?? null,
        forecast: data?.forecast ?? null,
        hourly: data?.hourly ?? null,
        loading,
        error,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within WeatherProvider');
  }
  return context;
}
