import './App.css';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import WeatherBar from './components/WeatherBar';
import Widgets from './components/Widgets';
import AnimatedClock from './components/AnimatedClock';
import WeatherAtmosphere from './components/WeatherAtmosphere';
import SpotifyLyricsOverlay from './components/SpotifyLyricsOverlay';
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
import {
  fadeTransition,
  nightDimAnimate,
} from './lib/dashboard-motion';

function TimeDisplay({ nightFocusActive }) {
  const [now, setNow] = useState(new Date());
  const { current, loading } = useWeather();
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const weekday = now.toLocaleDateString([], { weekday: 'long' });
  const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });
  const clockAnimation = settings.clockAnimation || 'off';
  const humidity =
    !loading && current?.humidity != null
      ? Math.max(0, Math.min(100, Number(current.humidity)))
      : 0;
  const cardEnter = (delay) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...fadeTransition(reduceMotion, 0.4), delay: reduceMotion ? 0 : delay },
  });

  return (
    <div className="time-container">
      <AnimatedClock now={now} animation={clockAnimation} />
      <motion.div
        className="time-container-dateCon"
        animate={nightDimAnimate(nightFocusActive, reduceMotion)}
      >
        <motion.div className="time-container-weekday stat-card" {...cardEnter(0)}>
          <div>{weekday}</div>
          <div>{date}</div>
        </motion.div>
        <motion.div className="time-container-stats-temp stat-card" {...cardEnter(0.06)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={loading ? 'loading' : current ? String(current.temperature) : 'na'}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={fadeTransition(reduceMotion, 0.35)}
            >
              {loading ? '—' : current ? `${current.temperature}°C` : 'N/A'}
            </motion.span>
          </AnimatePresence>
        </motion.div>
        <motion.div className="temp-container-stats-weather stat-card" {...cardEnter(0.12)}>
          <div className="CurrentWeather-Icon">
            <AnimatePresence mode="wait" initial={false}>
              {current?.iconUrl ? (
                <motion.img
                  key={current.iconUrl}
                  src={weatherIconUrl(current.iconUrl)}
                  alt="Weather Icon"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={fadeTransition(reduceMotion, 0.4)}
                />
              ) : (
                <motion.span
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {loading ? '…' : '—'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        <motion.div className="time-container-stats-humidity stat-card" {...cardEnter(0.18)}>
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
            <motion.div
              className="humidity-meter-fill"
              initial={false}
              animate={{ width: `${humidity}%` }}
              transition={
                reduceMotion
                  ? { duration: 0.15 }
                  : { type: 'spring', stiffness: 120, damping: 22 }
              }
            />
          </div>
        </motion.div>
      </motion.div>
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
  const reduceMotion = useReducedMotion();

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

  const backgroundStyle = buildDashboardBackgroundStyle(settings);
  const sectionOrder =
    Array.isArray(settings.sectionOrder) && settings.sectionOrder.length > 0
      ? settings.sectionOrder
      : ['header', 'weather', 'widgets'];
  const clockSide = settings.clockSide === 'right' ? 'right' : 'left';
  const density = ['compact', 'comfortable', 'roomy'].includes(settings.density)
    ? settings.density
    : 'comfortable';
  const clockSize = ['small', 'medium', 'large'].includes(settings.clockSize)
    ? settings.clockSize
    : 'medium';
  const clockFontSize = ['sm', 'md', 'lg', 'xl'].includes(settings.clockFontSize)
    ? settings.clockFontSize
    : 'md';
  const clearForcedWidget = () => setForcedWidget(null);
  const dim = nightDimAnimate(nightFocusActive, reduceMotion);
  const screenTransition = fadeTransition(reduceMotion, 0.45);

  const appClass = [
    'App',
    `clock-side-${clockSide}`,
    `density-${density}`,
    `clock-size-${clockSize}`,
    `clock-font-${clockFontSize}`,
    nightFocusActive ? 'night-focus' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sections = {
    header: (
      <header className="dashboard-header" key="header">
        <ErrorBoundary label="header" title="Clock unavailable">
          <TimeDisplay nightFocusActive={nightFocusActive} />
        </ErrorBoundary>
      </header>
    ),
    weather: (
      <motion.section
        className="dashboard-weather"
        key="weather"
        animate={dim}
      >
        <ErrorBoundary label="weather" title="Weather unavailable">
          <WeatherBar />
        </ErrorBoundary>
      </motion.section>
    ),
    widgets: (
      <motion.section
        className="dashboard-widgets"
        key="widgets"
        animate={dim}
      >
        <ErrorBoundary label="widgets" title="Widgets unavailable">
          <Widgets
            forcedWidget={forcedWidget}
            onWidgetShown={clearForcedWidget}
            pinned={widgetPinned}
          />
        </ErrorBoundary>
      </motion.section>
    ),
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {displayPower === 'off' || displayPower === 'sleep' ? (
        <motion.div
          key={`sleep-${displayPower}`}
          className={`display-sleep display-sleep--${displayPower}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: displayPower === 'off' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={screenTransition}
        />
      ) : (
        <motion.div
          key="dashboard"
          className={appClass}
          style={backgroundStyle || undefined}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.992 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={screenTransition}
        >
          <SpotifyLyricsOverlay />
          {sectionOrder.map((id) => sections[id] || null)}
          {/* Render last so rain/snow paint above all dashboard panels */}
          <WeatherAtmosphere />
        </motion.div>
      )}
    </AnimatePresence>
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
