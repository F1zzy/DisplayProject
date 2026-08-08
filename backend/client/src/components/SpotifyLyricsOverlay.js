import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getSpotifyNow } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { fadeTransition } from '../lib/dashboard-motion';
import './SpotifyLyricsOverlay.css';

const POLL_PLAYING_MS = 4000;
const POLL_IDLE_MS = 20000;

function findLineIndex(lines, progressMs) {
  if (!Array.isArray(lines) || lines.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].t <= progressMs) idx = i;
    else break;
  }
  return idx;
}

function LyricLine({ role, text, reduceMotion }) {
  const isCurrent = role === 'current' || role === 'upcoming';
  const y =
    role === 'prev' ? 8 : role === 'next' ? -8 : 0;

  return (
    <motion.div
      className={`spotify-lyrics-line is-${role}`}
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: isCurrent ? 14 : y }
      }
      animate={{
        opacity: role === 'current' ? 0.95 : role === 'upcoming' ? 0.7 : 0.5,
        y: reduceMotion ? 0 : y,
      }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: role === 'prev' ? -10 : 10 }
      }
      transition={fadeTransition(reduceMotion, 0.38)}
      layout={!reduceMotion}
    >
      {text}
    </motion.div>
  );
}

function SpotifyLyricsOverlay() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const enabled = settings.spotifyLyricsBackground !== false;
  const spotifyEnabled = Array.isArray(settings.enabledWidgets)
    ? settings.enabledWidgets.includes('spotify')
    : true;

  const [payload, setPayload] = useState(null);
  const [progressMs, setProgressMs] = useState(0);
  const anchorRef = useRef({ progressMs: 0, at: 0 });

  const load = useCallback(async () => {
    try {
      const data = await getSpotifyNow();
      setPayload(data);
      if (data?.playing && typeof data.progressMs === 'number') {
        anchorRef.current = { progressMs: data.progressMs, at: performance.now() };
        setProgressMs(data.progressMs);
      } else {
        setProgressMs(0);
      }
    } catch {
      setPayload(null);
      setProgressMs(0);
    }
  }, []);

  const playing = payload?.playing === true;
  const lines = payload?.lyrics?.lines;
  const hasLyrics = Array.isArray(lines) && lines.length > 0;

  useEffect(() => {
    if (!enabled || !spotifyEnabled) return undefined;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await load();
    }

    tick();
    const intervalMs = playing ? POLL_PLAYING_MS : POLL_IDLE_MS;
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, spotifyEnabled, load, playing]);

  useEffect(() => {
    if (!playing || !hasLyrics) return undefined;
    let frame = 0;
    const step = () => {
      const { progressMs: base, at } = anchorRef.current;
      const next = base + (performance.now() - at);
      const duration = payload?.track?.durationMs;
      setProgressMs(duration != null ? Math.min(next, duration) : next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, hasLyrics, payload?.track?.durationMs, payload?.fetchedAt]);

  const activeIndex = useMemo(() => findLineIndex(lines, progressMs), [lines, progressMs]);

  if (!enabled || !spotifyEnabled || !playing || !hasLyrics) {
    return null;
  }

  // Before the first timed line, preview it as upcoming so the overlay isn't blank.
  const prev = activeIndex > 0 ? lines[activeIndex - 1] : null;
  const current = activeIndex >= 0 ? lines[activeIndex] : null;
  const next =
    activeIndex >= 0
      ? activeIndex < lines.length - 1
        ? lines[activeIndex + 1]
        : null
      : lines[0];

  if (!current && !next) {
    return null;
  }

  return (
    <motion.div
      className="spotify-lyrics-overlay"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition(reduceMotion, 0.5)}
    >
      <div className="spotify-lyrics-veil" />
      <div className="spotify-lyrics-stack">
        <AnimatePresence mode="popLayout" initial={false}>
          {prev ? (
            <LyricLine
              key={`prev-${prev.t}-${prev.text}`}
              role="prev"
              text={prev.text}
              reduceMotion={reduceMotion}
            />
          ) : null}
          {current ? (
            <LyricLine
              key={`cur-${current.t}-${current.text}`}
              role="current"
              text={current.text}
              reduceMotion={reduceMotion}
            />
          ) : (
            <LyricLine
              key={`up-${next.t}-${next.text}`}
              role="upcoming"
              text={next.text}
              reduceMotion={reduceMotion}
            />
          )}
          {current && next ? (
            <LyricLine
              key={`next-${next.t}-${next.text}`}
              role="next"
              text={next.text}
              reduceMotion={reduceMotion}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default SpotifyLyricsOverlay;
