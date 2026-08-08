import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DASH_EASE, fadeTransition } from '../lib/dashboard-motion';
import './AnimatedClock.css';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function DigitCell({ value, mode, animate }) {
  const reduceMotion = useReducedMotion();

  if (mode === 'off' || !animate) {
    return <span className="clock-digit">{value}</span>;
  }

  const isFlip = mode === 'flip' && !reduceMotion;
  const transition = isFlip
    ? { duration: 0.45, ease: DASH_EASE }
    : fadeTransition(reduceMotion, 0.35);

  return (
    <span className={`clock-digit clock-digit--${isFlip ? 'flip' : 'crossfade'}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="clock-digit-layer"
          initial={
            isFlip
              ? { opacity: 0, rotateX: -80 }
              : { opacity: 0, y: reduceMotion ? 0 : 10 }
          }
          animate={isFlip ? { opacity: 1, rotateX: 0 } : { opacity: 1, y: 0 }}
          exit={
            isFlip
              ? { opacity: 0, rotateX: 80 }
              : { opacity: 0, y: reduceMotion ? 0 : -10 }
          }
          transition={transition}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Renders HH:MM:SS with optional minute-change animation (crossfade / flip).
 * Seconds update without animation and read quieter than hours/minutes.
 */
export default function AnimatedClock({ now, animation = 'off' }) {
  const reduced = useReducedMotion();
  const mode = reduced || animation === 'off' ? 'off' : animation;

  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());
  const minuteKey = `${hours}:${minutes}`;

  const prevMinuteRef = useRef(minuteKey);
  const [animateDigits, setAnimateDigits] = useState(false);

  useEffect(() => {
    if (prevMinuteRef.current !== minuteKey) {
      prevMinuteRef.current = minuteKey;
      if (mode === 'off') {
        setAnimateDigits(false);
        return undefined;
      }
      setAnimateDigits(true);
      const t = setTimeout(() => setAnimateDigits(false), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [minuteKey, mode]);

  const ariaLabel = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const animate = mode !== 'off' && animateDigits;

  return (
    <div
      className={`time-container-time clock-animated${mode !== 'off' ? ` clock-animated--${mode}` : ''}`}
      aria-label={ariaLabel}
    >
      <span className="clock-face">
        <span className="clock-block clock-block--hm">
          <DigitCell value={hours[0]} mode={mode} animate={animate} />
          <DigitCell value={hours[1]} mode={mode} animate={animate} />
          <span className="clock-sep" aria-hidden="true">
            :
          </span>
          <DigitCell value={minutes[0]} mode={mode} animate={animate} />
          <DigitCell value={minutes[1]} mode={mode} animate={animate} />
        </span>
        <span className="clock-block clock-block--seconds" aria-hidden="true">
          <span className="clock-sep clock-sep--seconds">:</span>
          <span className="clock-digit clock-digit--seconds">{seconds[0]}</span>
          <span className="clock-digit clock-digit--seconds">{seconds[1]}</span>
        </span>
      </span>
    </div>
  );
}
