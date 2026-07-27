import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSpotifyNow } from '../api/client';
import { useSettings } from '../context/SettingsContext';
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

function SpotifyLyricsOverlay() {
  const { settings } = useSettings();
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

  if (!enabled || !spotifyEnabled || !playing || !hasLyrics || activeIndex < 0) {
    return null;
  }

  const prev = activeIndex > 0 ? lines[activeIndex - 1] : null;
  const current = lines[activeIndex];
  const next = activeIndex < lines.length - 1 ? lines[activeIndex + 1] : null;

  return (
    <div className="spotify-lyrics-overlay" aria-hidden="true">
      <div className="spotify-lyrics-veil" />
      <div className="spotify-lyrics-stack">
        {prev ? <div className="spotify-lyrics-line is-prev">{prev.text}</div> : null}
        <div className="spotify-lyrics-line is-current">{current.text}</div>
        {next ? <div className="spotify-lyrics-line is-next">{next.text}</div> : null}
      </div>
    </div>
  );
}

export default SpotifyLyricsOverlay;
