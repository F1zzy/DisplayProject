import React from 'react';
import './HourlyForecast.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudRain, faWind, faArrowAltCircleUp } from '@fortawesome/free-solid-svg-icons';
import { useWeather } from '../context/WeatherContext';
import { weatherIconUrl } from '../api/client';

const WIND_ANGLES = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function formatHourLabel(timeStr) {
  const hour = new Date(timeStr).getHours();
  return `${String(hour).padStart(2, '0')}:00`;
}

function HourlyForecast() {
  const { hourly, loading, error } = useWeather();

  if (loading) return <div className="hourly-status">Loading hourly forecast…</div>;
  if (error) return <div className="hourly-status">Failed to load hourly forecast</div>;
  if (!hourly || hourly.length === 0) {
    return <div className="hourly-status">No hourly data available</div>;
  }

  const displayHours = hourly.slice(0, 12);
  const temperatures = displayHours.map((hour) => hour.temp_c);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const tempRange = maxTemp - minTemp || 1;
  const nowHour = new Date().getHours();

  return (
    <div className="hourly-graph" role="list" aria-label="12 hour forecast">
      {displayHours.map((hour, index) => {
        const temperature = hour.temp_c;
        const normalized = (temperature - minTemp) / tempRange;
        // Elevated fill only — labels sit outside so they never overlap.
        const barHeight = 18 + normalized * 82;
        const isNow = new Date(hour.time).getHours() === nowHour && index === 0;

        return (
          <div
            key={`${hour.time}-${index}`}
            className={`hourly-point${isNow ? ' hourly-point--now' : ''}`}
            role="listitem"
          >
            <div className="hourly-temp">{Math.round(temperature)}°</div>

            <div className="hourly-icon-wrap">
              <img
                className="hourly-weather-icon"
                src={weatherIconUrl(hour.condition.icon)}
                alt={hour.condition.text}
              />
            </div>

            <div className="hourly-bar-area" title={`${Math.round(temperature)}°C`}>
              <div className="hourly-bar" style={{ height: `${barHeight}%` }} />
            </div>

            <div className="hourly-time">{formatHourLabel(hour.time)}</div>

            <div className="hourly-meta">
              <div className="hourly-meta-row" title={`${hour.chance_of_rain}% chance of rain`}>
                <FontAwesomeIcon icon={faCloudRain} className="hourly-meta-icon" />
                <span>{hour.chance_of_rain}%</span>
              </div>
              <div
                className="hourly-meta-row"
                title={`${hour.wind_mph} mph ${hour.wind_dir}`}
              >
                <FontAwesomeIcon icon={faWind} className="hourly-meta-icon" />
                <span>{Math.round(hour.wind_mph)}</span>
                <FontAwesomeIcon
                  icon={faArrowAltCircleUp}
                  className="hourly-meta-icon hourly-wind-dir"
                  style={{
                    transform: `rotate(${WIND_ANGLES[hour.wind_dir] || 0}deg)`,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HourlyForecast;
