import React, { useState, useEffect } from 'react';
import { getCalendarEvents } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import './TimeTable.css';

function isPastEvent(event) {
  if (!event.start || event.allDay) return false;
  return new Date(event.start) < new Date();
}

function Timetable() {
  const { settings } = useSettings();
  const calendarDays = settings.calendarDays || 1;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState(null);

  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getCalendarEvents(calendarDays);
        if (cancelled) return;
        setConfigured(data.configured !== false);
        setEvents(data.events || []);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Unable to load calendar');
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [calendarDays]);

  return (
    <div className="widget-content timetable-widget">
      <h3>Today&apos;s Schedule</h3>
      <p className="timetable-date">{todayLabel}</p>

      {loading && <p className="widget-loading">Loading schedule…</p>}

      {!loading && error && <p className="timetable-empty">{error}</p>}

      {!loading && !error && !configured && (
        <p className="timetable-empty">
          Connect Google Calendar in the backend <code>.env</code> to show today&apos;s events.
        </p>
      )}

      {!loading && !error && configured && events.length === 0 && (
        <p className="timetable-empty">No more events today.</p>
      )}

      {!loading && !error && configured && events.length > 0 && (
        <ul className="timetable-list">
          {events.map((item) => (
            <li
              key={item.id || `${item.time}-${item.title}`}
              className={`timetable-item${isPastEvent(item) ? ' timetable-item--past' : ''}`}
            >
              <span className="timetable-time">{item.time}</span>
              <div>
                <strong>{item.title}</strong>
                {item.location ? (
                  <span className="timetable-location">{item.location}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Timetable;
