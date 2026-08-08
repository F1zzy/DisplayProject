import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { getSky } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import {
  fadeTransition,
  listContainerVariants,
  listItemVariants,
} from '../../lib/dashboard-motion';
import './NightSky.css';

function formatAltitude(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(0)}°`;
}

function NightSky() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const [sky, setSky] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bodyList = listContainerVariants(reduceMotion, 0.07);
  const bodyItem = listItemVariants(reduceMotion, 10);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getSky(settings.location);
        if (!cancelled) setSky(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Unable to load night sky');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 45 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [settings.location]);

  const bodies = Array.isArray(sky?.bodies) ? sky.bodies : [];
  const place = sky?.location || settings.location;

  return (
    <motion.div
      className="widget-content night-sky-widget"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeTransition(reduceMotion, 0.4)}
    >
      <h3>Night Sky</h3>

      {loading && !sky && <p className="widget-loading">Loading sky…</p>}
      {!loading && error && !sky && <p className="night-sky-empty">{error}</p>}

      {sky && (
        <>
          <p className="night-sky-place">{place}</p>

          <div className="night-sky-chart">
            <div className="night-sky-chart-sway">
              {sky.chartUrl ? (
                <motion.img
                  key={sky.chartUrl}
                  src={sky.chartUrl}
                  alt=""
                  className="night-sky-chart-image"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={fadeTransition(reduceMotion, 0.6)}
                />
              ) : (
                <p className="night-sky-empty">
                  {sky.configured?.chart
                    ? 'Star chart unavailable'
                    : 'Add AstronomyAPI credentials to show the chart'}
                </p>
              )}
            </div>
          </div>

          {bodies.length > 0 ? (
            <motion.div
              className="night-sky-bodies"
              aria-label="Visible planets and Moon"
              variants={bodyList}
              initial="hidden"
              animate="show"
            >
              {bodies.slice(0, 4).map((body) => (
                <motion.div
                  key={`${body.name}-${body.azimuth}`}
                  className="night-sky-body"
                  variants={bodyItem}
                >
                  <span className="night-sky-body-label">{body.name}</span>
                  <strong className="night-sky-body-value">{formatAltitude(body.altitude)}</strong>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="night-sky-empty">
              {sky.errors?.planets || 'No bright bodies above the horizon'}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

export default NightSky;
