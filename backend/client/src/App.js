import './App.css';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import WeatherBar from './components/WeatherBar';
import Widgets from './components/Widgets';
import AnimatedClock from './components/AnimatedClock';
import WeatherAtmosphere from './components/WeatherAtmosphere';
import ErrorBoundary from './components/ErrorBoundary';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { WeatherProvider, useWeather } from './context/WeatherContext';
import { useDisplayControl } from './hooks/useDisplayControl';
import { weatherIconUrl } from './api/client';
import {
  applyDocumentBackground,
  buildDashboardBackgroundStyle,
} from './utils/dashboardBackground';
import { applyDashboardAppearance } from './utils/dashboardAppearance';
import { shouldActivateNightFocus } from './utils/isNightTime';

const SECTION_COMPONENTS = {
  header: () => (
    <header className="dashboard-header" key="header">
      <ErrorBoundary label="header" title="Clock unavailable">
        <TimeDisplay />
      </ErrorBoundary>
    </header>
  ),
  weather: () => (
    <section className="dashboard-weather" key="weather">
      <ErrorBoundary label="weather" title="Weather unavailable">
        <WeatherBar />
      </ErrorBoundary>
    </section>
  ),
  widgets: (forcedWidget, onWidgetShown, pinned) => (
    <section className="dashboard-widgets" key="widgets">
      <ErrorBoundary label="widgets" title="Widgets unavailable">
        <Widgets
          forcedWidget={forcedWidget}
          onWidgetShown={onWidgetShown}
          pinned={pinned}
        />
      </ErrorBoundary>
    </section>
  ),
};

function TimeDisplay() {
  const [now, setNow] = useState(new Date());
  const { current, loading } = useWeather();
  const { settings } = useSettings();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const weekday = now.toLocaleDateString([], { weekday: 'long' });
  const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });
  const clockAnimation = settings.clockAnimation || 'off';

  return (
    <div className="time-container">
      <AnimatedClock now={now} animation={clockAnimation} />
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
  const [widgetPinned, setWidgetPinned] = useState(false);
  const [now, setNow] = useState(new Date());
  const { settings, applySettings } = useSettings();
  const { current, forecast } = useWeather();

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

  useEffect(() => {
    if (!settings.nightFocusMode) return undefined;
    const timer = setInterval(() => setNow(new Date()), 60000);
    setNow(new Date());
    return () => clearInterval(timer);
  }, [settings.nightFocusMode]);

  const handleDisplayMessage = useCallback(
    (message) => {
      if (message.type === 'display:power') {
        setDisplayPower(message.action);
      }
      if (message.type === 'widgets:rotate') {
        setForcedWidget(message.currentWidget);
        setWidgetPinned(false);
      }
      if (message.type === 'widgets:set') {
        setForcedWidget(message.currentWidget);
        if (typeof message.pinned === 'boolean') setWidgetPinned(message.pinned);
      }
      if (message.type === 'widgets:pin') {
        setWidgetPinned(Boolean(message.pinned));
        if (message.currentWidget != null) {
          setForcedWidget(message.currentWidget);
        }
      }
      if (message.type === 'settings:update') {
        applySettings(message.settings);
      }
    },
    [applySettings]
  );

  useDisplayControl(handleDisplayMessage);

  const nightFocusActive = useMemo(() => {
    return shouldActivateNightFocus(settings, current, forecast, now);
  }, [settings, current, forecast, now]);

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

  const appClass = [
    'App',
    `clock-side-${clockSide}`,
    `density-${density}`,
    nightFocusActive ? 'night-focus' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={appClass} style={backgroundStyle || undefined}>
      <WeatherAtmosphere />
      {sectionOrder.map((id) => {
        const render = SECTION_COMPONENTS[id];
        return render ? render(forcedWidget, clearForcedWidget, widgetPinned) : null;
      })}
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <WeatherProvider>
        <ErrorBoundary label="app" title="Display unavailable" message="Reload the page to recover the dashboard.">
          <AppContent />
        </ErrorBoundary>
      </WeatherProvider>
    </SettingsProvider>
  );
}

export default App;
