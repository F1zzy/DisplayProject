import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { getSky } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { fadeTransition } from '../../lib/dashboard-motion';
import { useWidgetLoadSequence } from '../../hooks/useWidgetLoadSequence';
import WidgetSkeleton from '../ui/WidgetSkeleton';
import './NightSky.css';

function formatAltitude(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(0)}°`;
}

function NightSky() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef(null);
  const [sky, setSky] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ready = Boolean(sky);
  const { showSkeleton } = useWidgetLoadSequence({ loading, ready, rootRef });

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

      {showSkeleton && <WidgetSkeleton label="Loading sky…" rows={4} />}
      {!loading && error && !sky && <p className="night-sky-empty">{error}</p>}

      {sky && (
        <div ref={rootRef} className="night-sky-content">
          <p className="night-sky-place" data-load-step="title">
            {place}
          </p>

          <div className="night-sky-chart" data-load-step="item">
            <div className="night-sky-chart-sway">
              {sky.chartUrl ? (
                <img src={sky.chartUrl} alt="" className="night-sky-chart-image" />
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
            <div className="night-sky-bodies" aria-label="Visible planets and Moon">
              {bodies.slice(0, 4).map((body) => (
                <div
                  key={`${body.name}-${body.azimuth}`}
                  className="night-sky-body"
                  data-load-step="item"
                >
                  <span className="night-sky-body-label">{body.name}</span>
                  <strong className="night-sky-body-value">{formatAltitude(body.altitude)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="night-sky-empty" data-load-step="item">
              {sky.errors?.planets || 'No bright bodies above the horizon'}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default NightSky;
