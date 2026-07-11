import React from 'react';
import './HourlyForecast.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudRain, faWind, faArrowAltCircleUp } from '@fortawesome/free-solid-svg-icons';
import { useWeather } from '../context/WeatherContext';
import { weatherIconUrl } from '../api/client';

function HourlyForecast() {
  const { hourly, loading, error } = useWeather();

  if (loading) return <div>Loading hourly forecast...</div>;
  if (error) return <div>Failed to load hourly forecast</div>;
  if (!hourly || hourly.length === 0) return <div>No hourly data available</div>;

  const temperatures = hourly.map((hour) => hour.temp_c);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);

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
      {hourly.map((hour, index) => {
        const temperature = hour.temp_c;
        const baseLine = (temperature - minTemp) / (maxTemp - minTemp);
        const heightPercentage = baseLine * 40 + 60;

        return (
          <div key={index} className="hourly-point" style={{ height: `${heightPercentage}%` }}>
            <div>
              <p className="temperature">{temperature}°C</p>
              <img
                className="weather-icon"
                src={weatherIconUrl(hour.condition.icon)}
                alt={hour.condition.text}
              />
              <p className="time">{new Date(hour.time).getHours()}:00</p>
            </div>
            <div className="hourly-details">
              <div className="rain-chance">
                <FontAwesomeIcon icon={faCloudRain} />
                <span>{hour.chance_of_rain}%</span>
              </div>
              <div className="wind-details">
                <FontAwesomeIcon icon={faWind} />
                <span> {hour.wind_mph} mph</span>
                <FontAwesomeIcon
                  icon={faArrowAltCircleUp}
                  style={{
                    marginLeft: '5px',
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
