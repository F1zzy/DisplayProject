import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import './HourlyForecast.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudRain, faWind, faArrowAltCircleUp } from '@fortawesome/free-solid-svg-icons';
import { useWeather } from '../context/WeatherContext';
import { weatherIconUrl } from '../api/client';

const WIND_ANGLES = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

const BAR_EASE = [0.22, 1, 0.36, 1];

const columnListVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

const columnItemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: BAR_EASE },
  },
};

const reducedColumnItemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
};

function formatHourLabel(timeStr) {
  const hour = new Date(timeStr).getHours();
  return `${String(hour).padStart(2, '0')}:00`;
}

function HourlyForecast() {
  const { hourly, loading, error } = useWeather();
  const reduceMotion = useReducedMotion();

  if (loading) return <div className="hourly-status">Loading hourly forecast…</div>;
  if (error) return <div className="hourly-status">Failed to load hourly forecast</div>;
  if (!hourly || hourly.length === 0) {
    return <div className="hourly-status">No hourly data available</div>;
  }

  const displayHours = hourly.slice(0, 12);
  const temperatures = displayHours.map((hour) => hour.temp_c);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const tempRange = maxTemp - minTemp || 1;
  const nowHour = new Date().getHours();
  const columnVariants = reduceMotion ? reducedColumnItemVariants : columnItemVariants;
  const barTransition = reduceMotion
    ? { duration: 0.2 }
    : { duration: 0.65, ease: BAR_EASE, delay: 0.12 };

  return (
    <motion.div
      className="hourly-graph"
      role="list"
      aria-label="12 hour forecast"
      variants={columnListVariants}
      initial="hidden"
      animate="show"
    >
      {displayHours.map((hour, index) => {
        const temperature = hour.temp_c;
        const normalized = (temperature - minTemp) / tempRange;
        // Elevated fill only — labels sit outside so they never overlap.
        const barHeight = 18 + normalized * 82;
        const isNow = new Date(hour.time).getHours() === nowHour && index === 0;

        return (
          <motion.div
            key={`${hour.time}-${index}`}
            className={`hourly-point${isNow ? ' hourly-point--now' : ''}`}
            role="listitem"
            variants={columnVariants}
          >
            <div className="hourly-temp">{Math.round(temperature)}°</div>

            <div className="hourly-icon-wrap">
              <img
                className="hourly-weather-icon"
                src={weatherIconUrl(hour.condition.icon)}
                alt={hour.condition.text}
              />
            </div>

            <div className="hourly-bar-area" title={`${Math.round(temperature)}°C`}>
              <motion.div
                className="hourly-bar"
                initial={reduceMotion ? false : { height: '6%' }}
                animate={{ height: `${barHeight}%` }}
                transition={barTransition}
              />
            </div>

            <div className="hourly-time">{formatHourLabel(hour.time)}</div>

            <div className="hourly-meta">
              <div className="hourly-meta-row" title={`${hour.chance_of_rain}% chance of rain`}>
                <FontAwesomeIcon icon={faCloudRain} className="hourly-meta-icon" />
                <span>{hour.chance_of_rain}%</span>
              </div>
              <div
                className="hourly-meta-row"
                title={`${hour.wind_mph} mph ${hour.wind_dir}`}
              >
                <FontAwesomeIcon icon={faWind} className="hourly-meta-icon" />
                <span>{Math.round(hour.wind_mph)}</span>
                <motion.span
                  className="hourly-wind-dir-wrap"
                  initial={reduceMotion ? false : { rotate: 0, opacity: 0.5 }}
                  animate={{
                    rotate: WIND_ANGLES[hour.wind_dir] || 0,
                    opacity: 1,
                  }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 220, damping: 22, delay: 0.2 }
                  }
                >
                  <FontAwesomeIcon
                    icon={faArrowAltCircleUp}
                    className="hourly-meta-icon hourly-wind-dir"
                    aria-hidden="true"
                  />
                </motion.span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default HourlyForecast;
