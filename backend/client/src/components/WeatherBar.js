import React, { useEffect, useState } from 'react';
import './WeatherBar.css';
import HourlyForecast from './HourlyForecast';
import { useWeather } from '../context/WeatherContext';
import { weatherIconUrl } from '../api/client';

function WeatherForecast() {
  const { forecast, loading, error } = useWeather();
  const [showHourly, setShowHourly] = useState(true);
  const [showMinTemp, setShowMinTemp] = useState(true);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setShowMinTemp((prev) => !prev);
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setShowHourly((prev) => !prev);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  if (loading) return <div>Getting Data. Wait to load</div>;
  if (error) return <div>Failed to load weather data</div>;
  if (!forecast) return <div>No forecast available</div>;

  const today = new Date().toISOString().split('T')[0];
  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <div className="forecast-container">
      <div className={`forecast-content ${showHourly ? 'visible' : 'hidden'}`}>
        <h2>7-Day Forecast</h2>
        <div className="forecast-row">
          {forecast.map((day) => (
            <div
              key={day.date}
              className={`forecast-item ${day.date === today ? 'highlighted' : ''}`}
            >
              <p>{day.date === today ? 'Today' : getDayName(day.date)}</p>
              <p>{formatDate(day.date)}</p>
              <img
                src={weatherIconUrl(day.day.condition.icon)}
                alt={day.day.condition.text}
              />
              <p>{day.day.condition.text}</p>

              <div className={`temp-sun-container-${showMinTemp ? 'show-min' : 'show-max'}`}>
                {showMinTemp ? (
                  <>
                    <p>Min Temp: {day.day.mintemp_c}°C</p>
                    <p>Sunrise: {day.astro.sunrise}</p>
                  </>
                ) : (
                  <>
                    <p>Max Temp: {day.day.maxtemp_c}°C</p>
                    <p>Sunset: {day.astro.sunset}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`hourly-content ${showHourly ? 'hidden' : 'visible'}`}>
        <h2>12 Hour Forecast</h2>
        <HourlyForecast />
      </div>
    </div>
  );
}

export default WeatherForecast;
