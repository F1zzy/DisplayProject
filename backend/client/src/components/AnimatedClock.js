import React, { useEffect, useRef, useState } from 'react';
import './AnimatedClock.css';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function DigitCell({ value, mode, animate }) {
  const [display, setDisplay] = useState(value);
  const [outgoing, setOutgoing] = useState(null);
  const [phase, setPhase] = useState('idle');
  const displayRef = useRef(value);
  const timerRef = useRef(null);

  useEffect(() => {
    if (value === displayRef.current) return undefined;

    if (!animate || mode === 'off') {
      displayRef.current = value;
      setDisplay(value);
      setOutgoing(null);
      setPhase('idle');
      return undefined;
    }

    const previous = displayRef.current;
    displayRef.current = value;
    setOutgoing(previous);
    setDisplay(value);
    setPhase(mode === 'flip' ? 'flip' : 'crossfade');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOutgoing(null);
      setPhase('idle');
    }, mode === 'flip' ? 500 : 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, animate, mode]);

  if (mode === 'off' || !animate) {
    return <span className="clock-digit">{value}</span>;
  }

  return (
    <span className={`clock-digit clock-digit--${mode} ${phase !== 'idle' ? `is-${phase}` : ''}`}>
      {outgoing != null ? (
        <span className="clock-digit-layer clock-digit-layer--out" aria-hidden="true">
          {outgoing}
        </span>
      ) : null}
      <span className="clock-digit-layer clock-digit-layer--in">{display}</span>
    </span>
  );
}

/**
 * Renders HH:MM:SS with optional minute-change animation (crossfade / flip).
 * Seconds update without animation.
 */
export default function AnimatedClock({ now, animation = 'off' }) {
  const reduced = prefersReducedMotion();
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

  if (mode === 'off') {
    return (
      <div className="time-container-time" aria-label={ariaLabel}>
        {`${hours}:${minutes}:${seconds}`}
      </div>
    );
  }

  return (
    <div className={`time-container-time clock-animated clock-animated--${mode}`} aria-label={ariaLabel}>
      <DigitCell value={hours[0]} mode={mode} animate={animateDigits} />
      <DigitCell value={hours[1]} mode={mode} animate={animateDigits} />
      <span className="clock-sep">:</span>
      <DigitCell value={minutes[0]} mode={mode} animate={animateDigits} />
      <DigitCell value={minutes[1]} mode={mode} animate={animateDigits} />
      <span className="clock-sep">:</span>
      <span className="clock-digit clock-digit--seconds">{seconds[0]}</span>
      <span className="clock-digit clock-digit--seconds">{seconds[1]}</span>
    </div>
  );
}
