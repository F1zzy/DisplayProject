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

  if (loading) return <div className="forecast-container panel widget-loading">Loading weather...</div>;
  if (error) return <div className="forecast-container panel widget-loading">Failed to load weather data</div>;
  if (!forecast) return <div className="forecast-container panel widget-loading">No forecast available</div>;

  const today = new Date().toISOString().split('T')[0];
  const forecastDays = forecast.slice(0, 3);

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
    <div className="forecast-container panel">
      <div className={`forecast-content ${showHourly ? 'visible' : 'hidden'}`}>
        <h2>3-Day Forecast</h2>
        <div className="forecast-row">
          {forecastDays.map((day) => (
            <div
              key={day.date}
              className={`forecast-item ${day.date === today ? 'highlighted' : ''}`}
            >
              <div className="forecast-item-header">
                <span className="forecast-day-name">
                  {day.date === today ? 'Today' : getDayName(day.date)}
                </span>
                <span className="forecast-day-date">{formatDate(day.date)}</span>
              </div>

              <div className="forecast-item-body">
                <img
                  className="forecast-icon"
                  src={weatherIconUrl(day.day.condition.icon)}
                  alt={day.day.condition.text}
                />
                <p className="forecast-condition">{day.day.condition.text}</p>
              </div>

              <div className="forecast-details">
                <div className={`forecast-details-block ${showMinTemp ? 'active' : ''}`}>
                  <div className="forecast-stat">
                    <span className="forecast-stat-label">Min</span>
                    <span className="forecast-stat-value">{day.day.mintemp_c}°C</span>
                  </div>
                  <div className="forecast-stat forecast-stat--secondary">
                    <span className="forecast-stat-label">Sunrise</span>
                    <span className="forecast-stat-value">{day.astro.sunrise}</span>
                  </div>
                </div>
                <div className={`forecast-details-block ${showMinTemp ? '' : 'active'}`}>
                  <div className="forecast-stat">
                    <span className="forecast-stat-label">Max</span>
                    <span className="forecast-stat-value">{day.day.maxtemp_c}°C</span>
                  </div>
                  <div className="forecast-stat forecast-stat--secondary">
                    <span className="forecast-stat-label">Sunset</span>
                    <span className="forecast-stat-value">{day.astro.sunset}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`hourly-content ${showHourly ? 'hidden' : 'visible'}`}>
        <h2>12-Hour Forecast</h2>
        <HourlyForecast />
      </div>
    </div>
  );
}

export default WeatherForecast;
