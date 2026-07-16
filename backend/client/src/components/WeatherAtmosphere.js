import React, { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useWeather } from '../context/WeatherContext';
import './WeatherAtmosphere.css';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Map WeatherAPI condition codes to atmosphere effect. */
export function resolveAtmosphereEffect(conditionCode, conditionText = '') {
  const code = Number(conditionCode);
  const text = String(conditionText).toLowerCase();

  // Snow / ice
  if (
    [1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255, 1258, 1261, 1264].includes(
      code
    ) ||
    text.includes('snow') ||
    text.includes('blizzard') ||
    text.includes('sleet')
  ) {
    return 'snow';
  }

  // Rain / drizzle / thunder
  if (
    [
      1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246, 1273, 1276, 1087,
    ].includes(code) ||
    text.includes('rain') ||
    text.includes('drizzle') ||
    text.includes('thunder')
  ) {
    return 'rain';
  }

  // Cloud / mist / fog / overcast
  if (
    [1003, 1006, 1009, 1030, 1135, 1147].includes(code) ||
    text.includes('cloud') ||
    text.includes('overcast') ||
    text.includes('mist') ||
    text.includes('fog')
  ) {
    return 'clouds';
  }

  // Clear / sunny — subtle haze only
  if ([1000].includes(code) || text.includes('sunny') || text.includes('clear')) {
    return 'haze';
  }

  return 'none';
}

function RainDrops() {
  const drops = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 10) * 0.18}s`,
        duration: `${0.7 + (i % 5) * 0.15}s`,
        opacity: 0.25 + (i % 4) * 0.1,
      })),
    []
  );

  return (
    <div className="atmosphere-rain" aria-hidden="true">
      {drops.map((d) => (
        <span
          key={d.id}
          className="atmosphere-rain-drop"
          style={{
            left: d.left,
            animationDelay: d.delay,
            animationDuration: d.duration,
            opacity: d.opacity,
          }}
        />
      ))}
    </div>
  );
}

function SnowFlakes() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${(i * 41) % 100}%`,
        delay: `${(i % 8) * 0.35}s`,
        duration: `${4 + (i % 5)}s`,
        size: `${4 + (i % 4) * 2}px`,
      })),
    []
  );

  return (
    <div className="atmosphere-snow" aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="atmosphere-snow-flake"
          style={{
            left: f.left,
            animationDelay: f.delay,
            animationDuration: f.duration,
            width: f.size,
            height: f.size,
          }}
        />
      ))}
    </div>
  );
}

function CloudDrift() {
  return (
    <div className="atmosphere-clouds" aria-hidden="true">
      <span className="atmosphere-cloud atmosphere-cloud--a" />
      <span className="atmosphere-cloud atmosphere-cloud--b" />
      <span className="atmosphere-cloud atmosphere-cloud--c" />
    </div>
  );
}

export default function WeatherAtmosphere() {
  const { settings } = useSettings();
  const { current } = useWeather();

  if (!settings.weatherAtmosphere || prefersReducedMotion() || !current) {
    return null;
  }

  const effect = resolveAtmosphereEffect(current.conditionCode, current.condition);
  if (effect === 'none') return null;

  return (
    <div className={`weather-atmosphere weather-atmosphere--${effect}`} aria-hidden="true">
      {effect === 'rain' ? <RainDrops /> : null}
      {effect === 'snow' ? <SnowFlakes /> : null}
      {effect === 'clouds' ? <CloudDrift /> : null}
      {effect === 'haze' ? <div className="atmosphere-haze" /> : null}
    </div>
  );
}
