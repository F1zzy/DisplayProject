import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentWeather, getForecast, getHourlyForecast, getLocation } from '../api/client';

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const location = getLocation();

    async function loadWeather() {
      try {
        const [currentData, forecastData, hourlyData] = await Promise.all([
          getCurrentWeather(location),
          getForecast(location, 3),
          getHourlyForecast(location),
        ]);
        setCurrent(currentData);
        setForecast(forecastData);
        setHourly(hourlyData);
      } catch (err) {
        console.error('Weather load failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadWeather();
  }, []);

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
