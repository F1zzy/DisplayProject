import React, { useEffect, useState } from 'react';
import { getSky } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import './NightSky.css';

function formatAltitude(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(0)}°`;
}

function NightSky() {
  const { settings } = useSettings();
  const [sky, setSky] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <div className="widget-content night-sky-widget">
      <h3>Night Sky</h3>

      {loading && !sky && <p className="widget-loading">Loading sky…</p>}
      {!loading && error && !sky && <p className="night-sky-empty">{error}</p>}

      {sky && (
        <>
          <p className="night-sky-place">{place}</p>

          <div className="night-sky-chart">
            <div className="night-sky-chart-sway">
              {sky.chartUrl ? (
                <img
                  src={sky.chartUrl}
                  alt=""
                  className="night-sky-chart-image"
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
            <div className="night-sky-bodies" aria-label="Visible planets and Moon">
              {bodies.slice(0, 4).map((body) => (
                <div key={`${body.name}-${body.azimuth}`} className="night-sky-body">
                  <span className="night-sky-body-label">{body.name}</span>
                  <strong className="night-sky-body-value">{formatAltitude(body.altitude)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="night-sky-empty">
              {sky.errors?.planets || 'No bright bodies above the horizon'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default NightSky;
