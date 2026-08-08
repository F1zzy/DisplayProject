import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getCalendarEvents } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import {
  fadeTransition,
  listContainerVariants,
  listItemVariants,
} from '../../lib/dashboard-motion';
import './TimeTable.css';

function isPastEvent(event) {
  if (!event.start || event.allDay) return false;
  return new Date(event.start) < new Date();
}

function Timetable() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const calendarDays = settings.calendarDays || 1;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState(null);
  const listVariants = listContainerVariants(reduceMotion, 0.05);
  const itemVariants = listItemVariants(reduceMotion, 10);

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
        {loading ? (
          <motion.p
            key="loading"
            className="widget-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Loading schedule…
          </motion.p>
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
          <motion.ul
            key="list"
            className="timetable-list"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {events.map((item) => (
              <motion.li
                key={item.id || `${item.time}-${item.title}`}
                className={`timetable-item${isPastEvent(item) ? ' timetable-item--past' : ''}`}
                variants={itemVariants}
              >
                <span className="timetable-time">{item.time}</span>
                <div>
                  <strong>{item.title}</strong>
                  {item.location ? (
                    <span className="timetable-location">{item.location}</span>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default Timetable;
