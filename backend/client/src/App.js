import './App.css';
import React, { useCallback, useState, useEffect } from 'react';
import WeatherBar from './components/WeatherBar';
import Widgets from './components/Widgets';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { WeatherProvider, useWeather } from './context/WeatherContext';
import { useDisplayControl } from './hooks/useDisplayControl';
import { weatherIconUrl } from './api/client';
import {
  applyDocumentBackground,
  buildDashboardBackgroundStyle,
} from './utils/dashboardBackground';
import { applyDashboardAppearance } from './utils/dashboardAppearance';

const SECTION_COMPONENTS = {
  header: () => (
    <header className="dashboard-header" key="header">
      <TimeDisplay />
    </header>
  ),
  weather: () => (
    <section className="dashboard-weather" key="weather">
      <WeatherBar />
    </section>
  ),
  widgets: (forcedWidget, onWidgetShown) => (
    <section className="dashboard-widgets" key="widgets">
      <Widgets forcedWidget={forcedWidget} onWidgetShown={onWidgetShown} />
    </section>
  ),
};

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
        <div className="time-container-weekday stat-card">
          <div>{weekday}</div>
          <div>{date}</div>
        </div>
        <div className="time-container-stats-temp stat-card">
          {loading ? '—' : current ? `${current.temperature}°C` : 'N/A'}
        </div>
        <div className="temp-container-stats-weather stat-card">
          <div className="CurrentWeather-Icon">
            {current?.iconUrl ? (
              <img src={weatherIconUrl(current.iconUrl)} alt="Weather Icon" />
            ) : (
              <span>{loading ? '…' : '—'}</span>
            )}
          </div>
        </div>
        <div className="time-container-stats-humidity stat-card">
          <span className="humidity-label">Humidity</span>
          <div className="humidity-value-row">
            <span className="humidity-value">
              {loading ? '—' : current?.humidity != null ? current.humidity : 'N/A'}
            </span>
            {!loading && current?.humidity != null ? (
              <span className="humidity-unit">%</span>
            ) : null}
          </div>
          <div
            className="humidity-meter"
            role="meter"
            aria-label="Humidity level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              !loading && current?.humidity != null ? Number(current.humidity) : undefined
            }
          >
            <div
              className="humidity-meter-fill"
              style={{
                width: `${
                  !loading && current?.humidity != null
                    ? Math.max(0, Math.min(100, Number(current.humidity)))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [displayPower, setDisplayPower] = useState('on');
  const [forcedWidget, setForcedWidget] = useState(null);
  const { settings, applySettings } = useSettings();

  useEffect(() => {
    applyDocumentBackground(settings);
    applyDashboardAppearance(settings);
    return () => {
      applyDocumentBackground({ backgroundMode: 'default' });
      applyDashboardAppearance({
        colorScheme: 'orange-dark',
        fontPreset: 'nothing',
      });
    };
  }, [settings]);

  const handleDisplayMessage = useCallback(
    (message) => {
      if (message.type === 'display:power') {
        setDisplayPower(message.action);
      }
      if (message.type === 'widgets:rotate') {
        setForcedWidget(message.currentWidget);
      }
      if (message.type === 'widgets:set') {
        setForcedWidget(message.currentWidget);
      }
      if (message.type === 'settings:update') {
        applySettings(message.settings);
      }
    },
    [applySettings]
  );

  useDisplayControl(handleDisplayMessage);

  if (displayPower === 'off' || displayPower === 'sleep') {
    return <div className={`display-sleep display-sleep--${displayPower}`} />;
  }

  const backgroundStyle = buildDashboardBackgroundStyle(settings);
  const sectionOrder =
    Array.isArray(settings.sectionOrder) && settings.sectionOrder.length > 0
      ? settings.sectionOrder
      : ['header', 'weather', 'widgets'];
  const clockSide = settings.clockSide === 'right' ? 'right' : 'left';
  const density = ['compact', 'comfortable', 'roomy'].includes(settings.density)
    ? settings.density
    : 'comfortable';
  const clearForcedWidget = () => setForcedWidget(null);

  return (
    <div
      className={`App clock-side-${clockSide} density-${density}`}
      style={backgroundStyle || undefined}
    >
      {sectionOrder.map((id) => {
        const render = SECTION_COMPONENTS[id];
        return render ? render(forcedWidget, clearForcedWidget) : null;
      })}
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <WeatherProvider>
        <AppContent />
      </WeatherProvider>
    </SettingsProvider>
  );
}

export default App;
