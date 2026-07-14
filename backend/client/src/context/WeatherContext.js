import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentWeather, getForecast, getHourlyForecast } from '../api/client';
import { useSettings } from './SettingsContext';

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
  const { settings } = useSettings();
  const location = settings.location;
  const forecastDays = settings.forecastDays;

  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setLoading(true);
      try {
        const [currentData, forecastData, hourlyData] = await Promise.all([
          getCurrentWeather(location),
          getForecast(location, forecastDays),
          getHourlyForecast(location),
        ]);
        if (cancelled) return;
        setCurrent(currentData);
        setForecast(forecastData);
        setHourly(hourlyData);
        setError(null);
      } catch (err) {
        console.error('Weather load failed:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [location, forecastDays]);

  return (
    <WeatherContext.Provider value={{ current, forecast, hourly, loading, error }}>
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
