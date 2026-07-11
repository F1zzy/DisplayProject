import React from 'react';
import './HourlyForecast.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudRain, faWind, faArrowAltCircleUp } from '@fortawesome/free-solid-svg-icons';
import { useWeather } from '../context/WeatherContext';
import { weatherIconUrl } from '../api/client';

function HourlyForecast() {
  const { hourly, loading, error } = useWeather();

  if (loading) return <div className="hourly-status">Loading hourly forecast...</div>;
  if (error) return <div className="hourly-status">Failed to load hourly forecast</div>;
  if (!hourly || hourly.length === 0) return <div className="hourly-status">No hourly data available</div>;

  const displayHours = hourly.slice(0, 12);
  const temperatures = displayHours.map((hour) => hour.temp_c);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const tempRange = maxTemp - minTemp || 1;

  const getRotationAngle = (direction) => {
    const angles = {
      N: 0,
      NE: 45,
      E: 90,
      SE: 135,
      S: 180,
      SW: 225,
      W: 270,
      NW: 315,
    };
    return angles[direction] || 0;
  };

  return (
    <div className="hourly-graph">
      {displayHours.map((hour, index) => {
        const temperature = hour.temp_c;
        const normalized = (temperature - minTemp) / tempRange;
        const barHeight = normalized * 40 + 60;

        return (
          <div key={`${hour.time}-${index}`} className="hourly-point">
            <div className="hourly-bar-area">
              <div
                className="hourly-bar"
                style={{ height: `${barHeight}%` }}
                title={`${Math.round(temperature)}°C`}
              >
                <p className="temperature">{Math.round(temperature)}°</p>
                <img
                  className="weather-icon"
                  src={weatherIconUrl(hour.condition.icon)}
                  alt={hour.condition.text}
                />
                <p className="time">{new Date(hour.time).getHours()}:00</p>
              </div>
            </div>
            <div className="hourly-details">
              <div className="rain-chance" title={`${hour.chance_of_rain}% chance of rain`}>
                <FontAwesomeIcon icon={faCloudRain} />
                <span>{hour.chance_of_rain}%</span>
              </div>
              <div className="wind-details" title={`${hour.wind_mph} mph ${hour.wind_dir}`}>
                <FontAwesomeIcon icon={faWind} />
                <span>{Math.round(hour.wind_mph)}</span>
                <FontAwesomeIcon
                  icon={faArrowAltCircleUp}
                  style={{
                    transform: `rotate(${getRotationAngle(hour.wind_dir)}deg)`,
                    transition: 'transform 0.3s ease',
                  }}
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
