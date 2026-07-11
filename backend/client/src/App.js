import './App.css';
import React, { useCallback, useState, useEffect } from 'react';
import WeatherBar from './components/WeatherBar';
import Widgets from './components/Widgets';
import { WeatherProvider, useWeather } from './context/WeatherContext';
import { useDisplayControl } from './hooks/useDisplayControl';
import { weatherIconUrl } from './api/client';

function TimeDisplay() {
  const [now, setNow] = useState(new Date());
  const { current, loading } = useWeather();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        <div className="temp-container-stats-temp">
          {loading ? 'Loading...' : current ? `${current.temperature}°C` : 'N/A'}
        </div>
        <div className="temp-container-stats-weather">
          <div></div>
          <div className="CurrentWeather-Temp">
            <h1>{loading ? 'Loading...' : current ? `${current.temperature}°C` : 'N/A'}</h1>
          </div>
          <div className="CurrentWeather-Icon">
            {current?.iconUrl && (
              <img src={weatherIconUrl(current.iconUrl)} alt="Weather Icon" />
            )}
          </div>
        </div>
        <div className="time-container-stats-humidity">
          {loading ? 'Humidity: --' : current ? `Humidity: ${current.humidity}%` : 'Humidity: N/A'}
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [displayPower, setDisplayPower] = useState('on');
  const [forcedWidget, setForcedWidget] = useState(null);

  const handleDisplayMessage = useCallback((message) => {
    if (message.type === 'display:power') {
      setDisplayPower(message.action);
    }
    if (message.type === 'widgets:rotate') {
      setForcedWidget(message.currentWidget);
    }
    if (message.type === 'widgets:set') {
      setForcedWidget(message.currentWidget);
    }
  }, []);

  useDisplayControl(handleDisplayMessage);

  if (displayPower === 'off' || displayPower === 'sleep') {
    return <div className={`display-sleep display-sleep--${displayPower}`} />;
  }

  return (
    <div className="App">
      <TimeDisplay />
      <WeatherBar />
      <Widgets forcedWidget={forcedWidget} onWidgetShown={() => setForcedWidget(null)} />
    </div>
  );
}

function App() {
  return (
    <WeatherProvider>
      <AppContent />
    </WeatherProvider>
  );
}

export default App;
