import './App.css';
import React, { useState, useEffect } from 'react';
import WeatherBar from './components/WeatherBar';
import Widgets from './components/Widgets';
async function getCurrentWeather(city) {
  const apiKey = process.env.REACT_APP_WEATHER_API_KEY ; // Replace with your WeatherAPI key
  const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&aqi=no`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Extract temperature and icon URL
    const temperature = data.current.temp_c; // Temperature in Celsius
    const iconUrl = data.current.condition.icon; // URL of the weather icon

    return { temperature, iconUrl };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return { temperature: null, iconUrl: '' }; // Return default values in case of error
  }
}

function TimeDisplay() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState({ temperature: null, iconUrl: '' });

  useEffect(() => {
    // Set an interval to update the time every second
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer); // Clear the interval on component unmount
  }, []);

  useEffect(() => {
    // Fetch weather data when the component mounts
    const fetchWeather = async () => {
      const weatherData = await getCurrentWeather('Nottingham'); // Replace with desired city
      setWeather(weatherData);
    };

    fetchWeather();
  }, []); // Empty dependency array to run only once on component mount

  // Format the time to include seconds
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const weekday = now.toLocaleDateString([], { weekday: 'long' });
  const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });

  return (
    <div className="time-container">
      <div className="time-container-time">{time}</div>
      <div className="time-container-dateCon">
        <div className="time-container-weekday">
          <div>{weekday}</div>
          <div>{date}</div>
        </div>
        <div className="temp-container-stats-temp">Temp: 89</div>
        <div className="temp-container-stats-weather">
          <div></div>
          <div className='CurrentWeather-Temp'> <h1>{weather.temperature !== null ? `${weather.temperature}°C` : 'Loading...'}</h1> </div>
         <div className='CurrentWeather-Icon'>{weather.iconUrl && <img src={`https:${weather.iconUrl}`} alt="Weather Icon" />}</div> 

        </div>
        <div className="time-container-stats-humidity">Humidity: 78%</div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <TimeDisplay />
      <WeatherBar />
     <Widgets />
      
      {/* Other components like Timetable, News, ValorantStats */}
    </div>
  );
}

export default App;
