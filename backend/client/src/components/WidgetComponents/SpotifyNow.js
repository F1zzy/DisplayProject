import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useColor } from 'color-thief-react';
import { getSpotifyNow } from '../../api/client';
import { usePollingFetch } from '../../hooks/usePollingFetch';
import WidgetSkeleton from '../ui/WidgetSkeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import { fadeTransition } from '../../lib/dashboard-motion';
import { useWidgetLoadSequence } from '../../hooks/useWidgetLoadSequence';
import './SpotifyNow.css';

const SPOTIFY_POLL_IDLE_MS = 20000;
const SPOTIFY_POLL_PLAYING_MS = 4000;

function formatArtists(artists) {
  if (!Array.isArray(artists) || artists.length === 0) return '—';
  return artists.join(', ');
}

function formatMs(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '0:00';
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function SpotifyNow() {
  const fetchSpotify = useCallback(() => getSpotifyNow(), []);
  const [playingPoll, setPlayingPoll] = useState(false);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef(null);
  const { data, loading, error } = usePollingFetch(fetchSpotify, {
    intervalMs: playingPoll ? SPOTIFY_POLL_PLAYING_MS : SPOTIFY_POLL_IDLE_MS,
  });

  const configured = data?.configured !== false;
  const track = data?.track;
  const topTracks = Array.isArray(data?.topTracks) ? data.topTracks : [];
  const playing = data?.playing === true;
  const showMain = Boolean(track) || (configured && topTracks.length > 0);
  const ready = Boolean(data) && showMain;
  const { showSkeleton } = useWidgetLoadSequence({ loading, ready, rootRef });

  useEffect(() => {
    setPlayingPoll(playing);
  }, [playing]);

  const [liveProgressMs, setLiveProgressMs] = useState(0);
  const anchorRef = useRef({ progressMs: 0, at: 0 });

  useEffect(() => {
    if (playing && typeof data?.progressMs === 'number') {
      anchorRef.current = { progressMs: data.progressMs, at: performance.now() };
      setLiveProgressMs(data.progressMs);
    } else {
      setLiveProgressMs(0);
    }
  }, [playing, data?.progressMs, data?.fetchedAt, track?.id]);

  useEffect(() => {
    if (!playing || track?.durationMs == null) return undefined;
    let frame = 0;
    const step = () => {
      const { progressMs: base, at } = anchorRef.current;
      const next = Math.min(track.durationMs, base + (performance.now() - at));
      setLiveProgressMs(next);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, track?.durationMs, data?.fetchedAt]);

  const progress =
    playing && track?.durationMs
      ? Math.max(0, Math.min(100, (liveProgressMs / track.durationMs) * 100))
      : 0;

  const albumArtUrl = track?.albumArt || '';
  const { data: dominantColor } = useColor(albumArtUrl, 'hex', {
    crossOrigin: 'anonymous',
    quality: 10,
  });
  const nowPlayingStyle =
    albumArtUrl && dominantColor
      ? {
          background: `linear-gradient(180deg, ${dominantColor} 0%, var(--bg-panel-elevated) 100%)`,
        }
      : undefined;

  return (
    <motion.div
      className="widget-content spotify-widget"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeTransition(reduceMotion, 0.4)}
    >
      <h3>Spotify</h3>

      {showSkeleton && <WidgetSkeleton label="Loading Spotify…" rows={5} />}

      {!loading && !configured && (
        <EmptyState className="spotify-empty">
          Add Spotify credentials and run <code>node scripts/spotify-auth.js</code> to connect.
        </EmptyState>
      )}

      {!loading && configured && error && !track && (
        <ErrorState className="spotify-empty">{error || 'Unable to load Spotify'}</ErrorState>
      )}

      {!loading && configured && !error && !track && topTracks.length === 0 && (
        <EmptyState className="spotify-empty">No recent Spotify activity</EmptyState>
      )}

      {showMain && (
        <div ref={rootRef} className="spotify-main" style={nowPlayingStyle}>
          <AnimatePresence mode="wait" initial={false}>
            {track ? (
              <motion.div
                key={track.id || track.name}
                className="spotify-now"
                data-load-step="title"
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={fadeTransition(reduceMotion, 0.4)}
              >
                <div className="spotify-now-art">
                  {track.albumArt ? (
                    <motion.img
                      src={track.albumArt}
                      alt=""
                      crossOrigin="anonymous"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={fadeTransition(reduceMotion, 0.45)}
                    />
                  ) : (
                    <div className="spotify-now-art-placeholder" />
                  )}
                </div>
                <div className="spotify-now-meta">
                  <span className={`spotify-badge ${playing ? 'is-playing' : ''}`}>
                    {playing ? 'Playing' : 'Last played'}
                  </span>
                  <div className="spotify-track-name">{track.name}</div>
                  <div className="spotify-track-artists">{formatArtists(track.artists)}</div>
                  {track.albumName ? <div className="spotify-track-album">{track.albumName}</div> : null}
                  {playing && track.durationMs != null ? (
                    <div className="spotify-progress" aria-hidden="true">
                      <div className="spotify-progress-bar">
                        <div className="spotify-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="spotify-progress-times">
                        <span>{formatMs(liveProgressMs)}</span>
                        <span>{formatMs(track.durationMs)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {configured && topTracks.length > 0 && (
            <div className="spotify-top">
              <div className="spotify-top-title" data-load-step="title">
                Top tracks
              </div>
              <ul className="spotify-top-list">
                {topTracks.map((item, index) => (
                  <li
                    key={item.id || `${item.name}-${index}`}
                    className="spotify-top-item"
                    data-load-step="item"
                  >
                    <span className="spotify-top-rank">{index + 1}</span>
                    {item.albumArt ? (
                      <img src={item.albumArt} alt="" className="spotify-top-art" />
                    ) : (
                      <span className="spotify-top-art spotify-top-art--empty" />
                    )}
                    <div className="spotify-top-meta">
                      <div className="spotify-top-name">{item.name}</div>
                      <div className="spotify-top-artists">{formatArtists(item.artists)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default SpotifyNow;
