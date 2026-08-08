import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import './WeatherBar.css';
import HourlyForecast from './HourlyForecast';
import { useWeather } from '../context/WeatherContext';
import { weatherIconUrl } from '../api/client';

const PANEL_EASE = [0.22, 1, 0.36, 1];

const panelVariants = {
  enter: (direction) => ({
    opacity: 0,
    x: direction >= 0 ? 36 : -36,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction >= 0 ? -28 : 28,
  }),
};

const reducedPanelVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const dayListVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

const dayItemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: PANEL_EASE },
  },
};

const reducedDayItemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

const detailVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const reducedDetailVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function WeatherForecast() {
  const { forecast, loading, error } = useWeather();
  const reduceMotion = useReducedMotion();
  const [showHourly, setShowHourly] = useState(true);
  const [showMinTemp, setShowMinTemp] = useState(true);
  const [panelDirection, setPanelDirection] = useState(1);
  const showHourlyRef = useRef(showHourly);
  showHourlyRef.current = showHourly;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setShowMinTemp((prev) => !prev);
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const showingDaily = showHourlyRef.current;
      setPanelDirection(showingDaily ? 1 : -1);
      setShowHourly(!showingDaily);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  if (loading) return <div className="forecast-container panel widget-loading">Loading weather...</div>;
  if (error) return <div className="forecast-container panel widget-loading">Failed to load weather data</div>;
  if (!forecast) return <div className="forecast-container panel widget-loading">No forecast available</div>;

  const today = new Date().toISOString().split('T')[0];
  const forecastDays = forecast.slice(0, 3);

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

  const panels = reduceMotion ? reducedPanelVariants : panelVariants;
  const days = reduceMotion ? reducedDayItemVariants : dayItemVariants;
  const details = reduceMotion ? reducedDetailVariants : detailVariants;
  const panelTransition = reduceMotion
    ? { duration: 0.18, ease: 'easeOut' }
    : { duration: 0.55, ease: PANEL_EASE };
  const detailTransition = reduceMotion
    ? { duration: 0.15 }
    : { duration: 0.4, ease: PANEL_EASE };

  return (
    <div className="forecast-container panel">
      <AnimatePresence mode="wait" initial={false} custom={panelDirection}>
        {showHourly ? (
          <motion.div
            key="daily"
            className="forecast-content"
            custom={panelDirection}
            variants={panels}
            initial="enter"
            animate="center"
            exit="exit"
            transition={panelTransition}
          >
            <h2>3-Day Forecast</h2>
            <motion.div
              className="forecast-row"
              variants={dayListVariants}
              initial="hidden"
              animate="show"
            >
              {forecastDays.map((day) => (
                <motion.div
                  key={day.date}
                  className={`forecast-item ${day.date === today ? 'highlighted' : ''}`}
                  variants={days}
                >
                  <div className="forecast-item-header">
                    <span className="forecast-day-name">
                      {day.date === today ? 'Today' : getDayName(day.date)}
                    </span>
                    <span className="forecast-day-date">{formatDate(day.date)}</span>
                  </div>

                  <div className="forecast-item-body">
                    <motion.img
                      className="forecast-icon"
                      src={weatherIconUrl(day.day.condition.icon)}
                      alt={day.day.condition.text}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.45, ease: PANEL_EASE, delay: 0.12 }}
                    />
                    <p className="forecast-condition">{day.day.condition.text}</p>
                  </div>

                  <div className="forecast-details">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={showMinTemp ? 'min' : 'max'}
                        className="forecast-details-block active"
                        variants={details}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={detailTransition}
                      >
                        {showMinTemp ? (
                          <>
                            <div className="forecast-stat">
                              <span className="forecast-stat-label">Min</span>
                              <span className="forecast-stat-value">{day.day.mintemp_c}°C</span>
                            </div>
                            <div className="forecast-stat forecast-stat--secondary">
                              <span className="forecast-stat-label">Sunrise</span>
                              <span className="forecast-stat-value">{day.astro.sunrise}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="forecast-stat">
                              <span className="forecast-stat-label">Max</span>
                              <span className="forecast-stat-value">{day.day.maxtemp_c}°C</span>
                            </div>
                            <div className="forecast-stat forecast-stat--secondary">
                              <span className="forecast-stat-label">Sunset</span>
                              <span className="forecast-stat-value">{day.astro.sunset}</span>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="hourly"
            className="hourly-content"
            custom={panelDirection}
            variants={panels}
            initial="enter"
            animate="center"
            exit="exit"
            transition={panelTransition}
          >
            <h2>12-Hour Forecast</h2>
            <HourlyForecast />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WeatherForecast;
