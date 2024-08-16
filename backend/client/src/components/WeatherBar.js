// src/components/WeatherBar.js
import React, { useEffect, useState } from 'react';
import './WeatherBar.css';
import HourlyForecast from './HourlyForecast';

function WeatherForecast() {
  const [forecast, setForecast] = useState(null);
  const [showHourly, setShowHourly] = useState(true);
  const [showMinTemp, setShowMinTemp] = useState(true);
  const API_KEY = process.env.REACT_APP_WEATHER_API_KEY ;
  const LOCATION = 'Nottingham';

  useEffect(() => {
    async function fetchForecast() {
      try {
        const response = await fetch(`http://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${LOCATION}&days=7`);
        const data = await response.json();
        console.log('Forecast Data:', data);
        setForecast(data.forecast.forecastday);
      } catch (error) {
        console.error('Error fetching forecast data:', error);
      }
    }

    fetchForecast();
  }, [API_KEY, LOCATION]);
  useEffect(() => {
    const intervalId = setInterval(() => {
      setShowMinTemp(prev => !prev);
    }, 3000);

    

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setShowHourly(prev => !prev);
    }, 3000000); // Toggle view every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  if (!forecast) return <div>Getting Data. Wait to load </div>;

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
          {forecast.map(day => (
            <div
              key={day.date}
              className={`forecast-item ${day.date === today ? 'highlighted' : ''}`}>
              <p>{day.date === today ? 'Today' : getDayName(day.date)}</p>
              <p>{formatDate(day.date)}</p>
              <img src={day.day.condition.icon} alt={day.day.condition.text} />
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
