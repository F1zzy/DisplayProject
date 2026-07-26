import React, { useCallback, useEffect, useState } from 'react';
import { getF1Standings } from '../../api/client';
import { usePollingFetch } from '../../hooks/usePollingFetch';
import LoadingState from '../ui/LoadingState';
import ErrorState from '../ui/ErrorState';
import './F1Standings.css';

const LIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 5 * 60 * 1000;
const MAX_DRIVER_ROWS = 10;
const MAX_CONSTRUCTOR_ROWS = 8;

/** Track status codes that should tint the live panel. */
const TRACK_STATUS_CLASS = {
  2: 'f1-track--yellow',
  3: 'f1-track--yellow',
  4: 'f1-track--safety',
  5: 'f1-track--red',
  6: 'f1-track--safety',
  7: 'f1-track--safety',
};

function driverLabel(driver) {
  if (driver.code) return driver.code;
  if (driver.familyName) return driver.familyName.slice(0, 3).toUpperCase();
  return '—';
}

function formatGap(entry) {
  if (entry.retired) return 'OUT';
  if (entry.inPit) return 'PIT';
  if (entry.position === 1) return 'LEADER';
  return entry.gapToLeader || entry.interval || '—';
}

function F1Standings() {
  const fetchF1 = useCallback(() => getF1Standings(), []);
  // Poll hard only while a session is running; the hook re-arms on interval change.
  const [pollMs, setPollMs] = useState(IDLE_POLL_MS);
  const { data, loading, error } = usePollingFetch(fetchF1, { intervalMs: pollMs });

  const sessionActive = data?.live?.active === true;
  useEffect(() => {
    setPollMs(sessionActive ? LIVE_POLL_MS : IDLE_POLL_MS);
  }, [sessionActive]);

  const drivers = Array.isArray(data?.drivers) ? data.drivers : [];
  const constructors = Array.isArray(data?.constructors) ? data.constructors : [];
  const live = data?.live;
  const isLive = sessionActive;
  const liveOrder = Array.isArray(live?.order) ? live.order : [];
  const leaderPoints = constructors[0]?.points || 0;

  return (
    <div className="widget-content f1-widget">
      <h3>
        Formula 1
        {data?.season ? <span className="f1-season">{data.season}</span> : null}
      </h3>

      {loading && !data && <LoadingState>Loading standings…</LoadingState>}

      {!loading && error && !data && (
        <ErrorState className="f1-empty">{error || 'Unable to load F1 standings'}</ErrorState>
      )}

      {data && (
        <div className="f1-columns">
          <section
            className={`f1-panel ${isLive ? TRACK_STATUS_CLASS[live.trackStatusCode] || '' : ''}`}
          >
            <div className="f1-panel-head">
              <span className="f1-panel-title">{isLive ? live.sessionName || 'Live' : 'Drivers'}</span>
              {isLive ? (
                <span className="f1-live-badge">Live</span>
              ) : (
                <span className="f1-panel-meta">{data.round ? `Round ${data.round}` : ''}</span>
              )}
            </div>

            {isLive && (
              <div className="f1-live-meta">
                <span className="f1-live-meeting">{live.meetingName || ''}</span>
                {live.lap != null && (
                  <span className="f1-live-lap">
                    Lap {live.lap}
                    {live.totalLaps ? `/${live.totalLaps}` : ''}
                  </span>
                )}
                {live.trackStatus && <span className="f1-live-flag">{live.trackStatus}</span>}
              </div>
            )}

            <ol className="f1-list">
              {isLive
                ? liveOrder.slice(0, MAX_DRIVER_ROWS).map((entry) => (
                    <li
                      key={entry.number ?? entry.position}
                      className={`f1-row f1-row--live ${entry.retired ? 'is-out' : ''} ${
                        entry.inPit ? 'is-pit' : ''
                      }`}
                    >
                      <span className="f1-pos">{entry.position}</span>
                      <span
                        className="f1-team-bar"
                        style={entry.teamColour ? { background: entry.teamColour } : undefined}
                        aria-hidden="true"
                      />
                      <span className="f1-name">{entry.code || entry.number || '—'}</span>
                      <span className="f1-gap">{formatGap(entry)}</span>
                    </li>
                  ))
                : drivers.slice(0, MAX_DRIVER_ROWS).map((driver) => (
                    <li key={driver.driverId || driver.position} className="f1-row">
                      <span className="f1-pos">{driver.position}</span>
                      <span className="f1-name">{driverLabel(driver)}</span>
                      <span className="f1-sub">{driver.constructor || ''}</span>
                      <span className="f1-points">{driver.points}</span>
                    </li>
                  ))}
            </ol>
          </section>

          <section className="f1-panel">
            <div className="f1-panel-head">
              <span className="f1-panel-title">Constructors</span>
            </div>

            <ol className="f1-list">
              {constructors.slice(0, MAX_CONSTRUCTOR_ROWS).map((team) => (
                <li key={team.constructorId || team.position} className="f1-row f1-row--team">
                  <span className="f1-pos">{team.position}</span>
                  <span className="f1-name f1-name--team">{team.name || '—'}</span>
                  <span className="f1-bar" aria-hidden="true">
                    <span
                      className="f1-bar-fill"
                      style={{
                        width: leaderPoints ? `${(team.points / leaderPoints) * 100}%` : '0%',
                      }}
                    />
                  </span>
                  <span className="f1-points">{team.points}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}

export default F1Standings;
