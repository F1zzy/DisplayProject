/**
 * Detect night for soft focus mode.
 * Prefer weather `isDay`; fall back to today's sunrise/sunset from forecast.
 */

function parseAstroTime(date, timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function isNightTime(current, forecast, now = new Date()) {
  if (current && typeof current.isDay === 'boolean') {
    return current.isDay === false;
  }

  const day = Array.isArray(forecast) && forecast[0] ? forecast[0] : null;
  const astro = day?.astro || day?.day?.astro;
  if (astro?.sunrise && astro?.sunset) {
    const sunrise = parseAstroTime(now, astro.sunrise);
    const sunset = parseAstroTime(now, astro.sunset);
    if (sunrise && sunset) {
      return now < sunrise || now >= sunset;
    }
  }

  const hour = now.getHours();
  return hour < 6 || hour >= 20;
}
