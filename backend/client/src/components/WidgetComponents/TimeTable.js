import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getCalendarEvents } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { fadeTransition } from '../../lib/dashboard-motion';
import { useWidgetLoadSequence } from '../../hooks/useWidgetLoadSequence';
import WidgetSkeleton from '../ui/WidgetSkeleton';
import './TimeTable.css';

function isPastEvent(event) {
  if (!event.start || event.allDay) return false;
  return new Date(event.start) < new Date();
}

function Timetable() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef(null);
  const calendarDays = settings.calendarDays || 1;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState(null);
  const ready = !loading;
  const { showSkeleton } = useWidgetLoadSequence({ loading, ready, rootRef });

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
    <motion.div
      className="widget-content timetable-widget"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeTransition(reduceMotion, 0.4)}
    >
      <h3>Today&apos;s Schedule</h3>
      <p className="timetable-date">{todayLabel}</p>

      <AnimatePresence mode="wait" initial={false}>
        {showSkeleton ? (
          <WidgetSkeleton key="loading" label="Loading schedule…" rows={4} />
        ) : error ? (
          <motion.p
            key="error"
            className="timetable-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        ) : !configured ? (
          <motion.p
            key="unconfigured"
            className="timetable-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Connect Google Calendar in the backend <code>.env</code> to show today&apos;s events.
          </motion.p>
        ) : events.length === 0 ? (
          <motion.p
            key="empty"
            className="timetable-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            No more events today.
          </motion.p>
        ) : (
          <ul key="list" ref={rootRef} className="timetable-list">
            {events.map((item) => (
              <li
                key={item.id || `${item.time}-${item.title}`}
                className={`timetable-item${isPastEvent(item) ? ' timetable-item--past' : ''}`}
                data-load-step="item"
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
      </AnimatePresence>
    </motion.div>
  );
}

export default Timetable;
