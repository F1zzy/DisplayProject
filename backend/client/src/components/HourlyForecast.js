// src/components/HourlyForecast.js

import React, { useEffect, useState } from 'react';
import './HourlyForecast.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudRain, faWind, faArrowAltCircleUp } from '@fortawesome/free-solid-svg-icons'; // Import the compass icon
import { subHours, addHours } from 'date-fns'; // Import date-fns functions

function HourlyForecast() {
  const [hourly, setHourly] = useState(null);
  const API_KEY = process.env.REACT_APP_WEATHER_API_KEY   ;
  const LOCATION = 'Nottingham';

  useEffect(() => {
    async function fetchHourlyForecast() {
      try {
        const now = new Date();

        // Fetch historical data for the previous 2 hours
        const historicalData = [];
        for (let i = 2; i > 0; i--) {
          const pastHourDate = subHours(now, i);
          const pastResponse = await fetch(
            `http://api.weatherapi.com/v1/history.json?key=${API_KEY}&q=${LOCATION}&dt=${pastHourDate.toISOString().split('T')[0]}`
          );
          const pastData = await pastResponse.json();
          historicalData.push(pastData.forecast.forecastday[0].hour[pastHourDate.getHours()]);
        }

        // Fetch forecast data for the current hour and the next 9 hours
        const forecastResponse = await fetch(
          `http://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${LOCATION}&days=2`
        );
        const forecastData = await forecastResponse.json();

        const forecastHours = [];
        for (let i = 0; i < 9; i++) {
          const futureHourDate = addHours(now, i);
          const dayIndex = futureHourDate.getDate() === now.getDate() ? 0 : 1; // Handle cross-day boundary
          forecastHours.push(forecastData.forecast.forecastday[dayIndex].hour[futureHourDate.getHours()]);
        }

        // Combine historical data with forecast data
        const combinedHourlyData = [...historicalData, ...forecastHours];
        setHourly(combinedHourlyData);
      } catch (error) {
        console.error('Error fetching hourly data:', error);
      }
    }

    fetchHourlyForecast();
  }, [API_KEY, LOCATION]);

  if (!hourly) return <div>Loading hourly forecast...</div>;

  // Find the min and max temperature in the forecast to scale the heights
  const temperatures = hourly.map(hour => hour.temp_c);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);

  // Function to get rotation angle based on wind direction
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
    return angles[direction] || 0; // Default to 0 if direction is unknown
  };

  return (

      <div className="hourly-graph">
        {hourly.map((hour, index) => {
          const temperature = hour.temp_c;
          const baseLine = ((temperature - minTemp) / (maxTemp - minTemp))
          const heightPercentage =  baseLine * 40 + 60 ; // Adjust height

          return (
            <div
              key={index}
              className="hourly-point"
             style={{ height: `${heightPercentage}%` }}  
            >
              <div              
              
                 >
                <p className="temperature">{temperature}°C</p>
                <img className="weather-icon" src={hour.condition.icon} alt={hour.condition.text} />
                <p className="time" >{new Date(hour.time).getHours()}:00</p>
              </div>
              <div className="hourly-details"
              >
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
                      transform: `rotate(${getRotationAngle(hour.wind_dir)}deg)`, // Rotate compass icon
                      transition: 'transform 0.3s ease', // Smooth rotation
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
