import React, { useCallback, useEffect, useState } from 'react';
import { getF1Standings } from '../../api/client';
import { usePollingFetch } from '../../hooks/usePollingFetch';
import LoadingState from '../ui/LoadingState';
import ErrorState from '../ui/ErrorState';
import './F1Standings.css';

const LIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 5 * 60 * 1000;
/** Primary target is portrait 1080×1920; trim rows only on landscape fallback. */
const MAX_DRIVER_ROWS = 20;
const MAX_DRIVER_ROWS_LANDSCAPE = 12;
const MAX_CONSTRUCTOR_ROWS = 11;

function useLandscape() {
  const [landscape, setLandscape] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: landscape)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(orientation: landscape)');
    const onChange = () => setLandscape(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return landscape;
}

/** Track status codes that should tint the live panel. */
const TRACK_STATUS_CLASS = {
  2: 'f1-track--yellow',
  3: 'f1-track--yellow',
  4: 'f1-track--safety',
  5: 'f1-track--red',
  6: 'f1-track--safety',
  7: 'f1-track--safety',
};

/**
 * Team colours for the row accents. Live timing sends its own colour per
 * driver, but the championship endpoints do not carry one, so these are the
 * teams' own brand colours.
 */
const TEAM_COLOURS = {
  alpine: '#0093cc',
  aston_martin: '#229971',
  audi: '#f50537',
  cadillac: '#a5915f',
  ferrari: '#e8002d',
  haas: '#b6babd',
  mclaren: '#ff8000',
  mercedes: '#27f4d2',
  rb: '#6692ff',
  red_bull: '#3671c6',
  williams: '#64c4ff',
};

function teamColour(constructorId) {
  return TEAM_COLOURS[constructorId] || 'var(--border-strong)';
}

function driverCode(driver) {
  if (driver.code) return driver.code;
  if (driver.familyName) return driver.familyName.slice(0, 3).toUpperCase();
  return '—';
}

function driverName(driver) {
  const full = [driver.givenName, driver.familyName].filter(Boolean).join(' ');
  return full || driver.code || '';
}

function formatGap(entry) {
  if (entry.retired) return 'OUT';
  if (entry.inPit) return 'PIT';
  if (entry.position === 1) return 'LEADER';
  return entry.gapToLeader || entry.interval || '—';
}

/**
 * Coarse countdown to the next race. Precision beyond hours is pointless here:
 * the widget only refetches every five minutes while idle.
 */
function formatCountdown(startsAt) {
  if (!startsAt) return '';

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';

  const minutesAway = Math.round((start.getTime() - Date.now()) / 60000);
  if (minutesAway <= 0) return 'Under way';

  const days = Math.floor(minutesAway / 1440);
  const hours = Math.floor((minutesAway % 1440) / 60);

  if (days >= 1) return `in ${days}d ${hours}h`;
  if (hours >= 1) return `in ${hours}h`;
  return `in ${minutesAway}m`;
}

function formatRaceTime(startsAt) {
  if (!startsAt) return '';

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';

  return start.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PositionDelta({ value }) {
  if (value == null || value === 0) {
    return <span className="f1-delta f1-delta--flat" aria-hidden="true" />;
  }

  const up = value > 0;
  return (
    <span
      className={`f1-delta ${up ? 'f1-delta--up' : 'f1-delta--down'}`}
      title={`${Math.abs(value)} ${up ? 'gained' : 'lost'}`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(value)}
    </span>
  );
}

function ConstructorLogo({ constructorId, season }) {
  const [failed, setFailed] = useState(false);

  if (!constructorId || failed) {
    return <span className="f1-logo f1-logo--empty" aria-hidden="true" />;
  }

  const query = season ? `?season=${encodeURIComponent(season)}` : '';
  return (
    <img
      className="f1-logo"
      src={`/api/f1/logo/${encodeURIComponent(constructorId)}${query}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function SoftImage({ className, src, emptyClassName }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return emptyClassName ? <span className={emptyClassName} aria-hidden="true" /> : null;
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function NextRace({ race }) {
  if (!race) return null;

  const where = [race.locality, race.country].filter(Boolean).join(', ');
  const flagSrc = race.country
    ? `/api/f1/flag/${encodeURIComponent(race.country)}`
    : null;
  const circuitSrc = race.circuitId
    ? `/api/f1/circuit/${encodeURIComponent(race.circuitId)}`
    : null;

  return (
    <div className="f1-next">
      <span className="f1-next-label">Next</span>
      {race.round != null && <span className="f1-next-round">R{race.round}</span>}
      <span className="f1-next-name">{race.raceName || 'TBC'}</span>
      {(flagSrc || where) && (
        <span className="f1-next-where">
          <SoftImage className="f1-flag" src={flagSrc} emptyClassName="f1-flag f1-flag--empty" />
          {where}
        </span>
      )}
      {circuitSrc && <SoftImage className="f1-circuit" src={circuitSrc} />}
      {race.startsAt && (
        <>
          <span className="f1-next-when">{formatRaceTime(race.startsAt)}</span>
          <span className="f1-next-count">{formatCountdown(race.startsAt)}</span>
        </>
      )}
    </div>
  );
}

function LiveStatus({ live }) {
  return (
    <div className="f1-live">
      <span className="f1-live-badge">Live</span>
      <span className="f1-live-meeting">{live.meetingName || ''}</span>
      {live.sessionName && <span className="f1-live-session">{live.sessionName}</span>}
      {live.lap != null && (
        <span className="f1-live-lap">
          Lap {live.lap}
          {live.totalLaps ? `/${live.totalLaps}` : ''}
        </span>
      )}
      {live.trackStatus && <span className="f1-live-flag">{live.trackStatus}</span>}
    </div>
  );
}

function F1Standings() {
  const fetchF1 = useCallback(() => getF1Standings(), []);
  // Poll hard only while a session is running; the hook re-arms on interval change.
  const [pollMs, setPollMs] = useState(IDLE_POLL_MS);
  const { data, loading, error } = usePollingFetch(fetchF1, { intervalMs: pollMs });
  const landscape = useLandscape();
  const maxDrivers = landscape ? MAX_DRIVER_ROWS_LANDSCAPE : MAX_DRIVER_ROWS;
  const maxConstructors = MAX_CONSTRUCTOR_ROWS;

  const sessionActive = data?.live?.active === true;
  useEffect(() => {
    setPollMs(sessionActive ? LIVE_POLL_MS : IDLE_POLL_MS);
  }, [sessionActive]);

  const drivers = Array.isArray(data?.drivers) ? data.drivers : [];
  const constructors = Array.isArray(data?.constructors) ? data.constructors : [];
  const live = data?.live;
  const isLive = sessionActive;
  const liveOrder = Array.isArray(live?.order) ? live.order : [];
  const driverRows = isLive
    ? liveOrder.slice(0, maxDrivers)
    : drivers.slice(0, maxDrivers);
  const constructorRows = constructors.slice(0, maxConstructors);

  // Points bars are drawn relative to whoever leads each championship.
  const driverLead = drivers[0]?.points || 0;
  const teamLead = constructors[0]?.points || 0;
  const share = (points, lead) => (lead ? `${Math.max(0, (points / lead) * 100)}%` : '0%');

  return (
    <div className="widget-content f1-widget">
      <header className="f1-head">
        <div className="f1-brand">
          <span className="f1-mark" aria-hidden="true" />
          <h3>Formula 1</h3>
          {data?.season && <span className="f1-season">{data.season}</span>}
          {data?.round != null && <span className="f1-round">Round {data.round}</span>}
        </div>
        {data && (isLive ? <LiveStatus live={live} /> : <NextRace race={data.nextRace} />)}
      </header>

      {loading && !data && <LoadingState>Loading standings…</LoadingState>}

      {!loading && error && !data && (
        <ErrorState className="f1-empty">{error || 'Unable to load F1 standings'}</ErrorState>
      )}

      {data && (
        <div className="f1-columns">
          <section
            className={`f1-panel ${isLive ? TRACK_STATUS_CLASS[live.trackStatusCode] || '' : ''}`}
          >
            <div className="f1-colhead f1-colhead--driver">
              <span className="f1-pos">#</span>
              <span />
              <span />
              <span>Driver</span>
              <span className="f1-hide-narrow" />
              <span>Team</span>
              <span />
              <span className="f1-num">{isLive ? 'Gap' : 'Pts'}</span>
            </div>

            <ol
              className="f1-list"
              style={{ '--f1-rows': Math.max(driverRows.length, 1) }}
            >
              {isLive
                ? driverRows.map((entry) => (
                    <li
                      key={entry.number ?? entry.position}
                      className={`f1-row f1-row--driver ${entry.retired ? 'is-out' : ''} ${
                        entry.inPit ? 'is-pit' : ''
                      }`}
                      style={{
                        '--team': entry.teamColour || teamColour(entry.constructorId),
                      }}
                    >
                      <span className="f1-pos">{entry.position}</span>
                      <span className="f1-accent" aria-hidden="true" />
                      <ConstructorLogo constructorId={entry.constructorId} season={data.season} />
                      <span className="f1-code">{entry.code || entry.number || '—'}</span>
                      <span className="f1-full f1-hide-narrow">{entry.name || ''}</span>
                      <span className="f1-team">{entry.team || ''}</span>
                      <PositionDelta value={entry.positionChange} />
                      <span className="f1-num f1-gap">{formatGap(entry)}</span>
                    </li>
                  ))
                : driverRows.map((driver) => (
                    <li
                      key={driver.driverId || driver.position}
                      className="f1-row f1-row--driver"
                      style={{ '--team': teamColour(driver.constructorId) }}
                    >
                      <span
                        className="f1-fill"
                        style={{ width: share(driver.points, driverLead) }}
                        aria-hidden="true"
                      />
                      <span className="f1-pos">{driver.position}</span>
                      <span className="f1-accent" aria-hidden="true" />
                      <ConstructorLogo constructorId={driver.constructorId} season={data.season} />
                      <span className="f1-code">{driverCode(driver)}</span>
                      <span className="f1-full f1-hide-narrow">{driverName(driver)}</span>
                      <span className="f1-team">{driver.constructor || ''}</span>
                      <PositionDelta value={driver.positionChange} />
                      <span className="f1-num f1-points">{driver.points}</span>
                    </li>
                  ))}
            </ol>
          </section>

          <section className="f1-panel">
            <div className="f1-colhead f1-colhead--team">
              <span className="f1-pos">#</span>
              <span />
              <span />
              <span>Constructor</span>
              <span />
              <span className="f1-num">Wins</span>
              <span className="f1-num">Pts</span>
            </div>

            <ol
              className="f1-list"
              style={{ '--f1-rows': Math.max(constructorRows.length, 1) }}
            >
              {constructorRows.map((team) => (
                <li
                  key={team.constructorId || team.position}
                  className="f1-row f1-row--team"
                  style={{ '--team': teamColour(team.constructorId) }}
                >
                  <span
                    className="f1-fill"
                    style={{ width: share(team.points, teamLead) }}
                    aria-hidden="true"
                  />
                  <span className="f1-pos">{team.position}</span>
                  <span className="f1-accent" aria-hidden="true" />
                  <ConstructorLogo constructorId={team.constructorId} season={data.season} />
                  <span className="f1-name f1-name--team">{team.name || '—'}</span>
                  <PositionDelta value={team.positionChange} />
                  <span className="f1-num f1-wins">{team.wins}</span>
                  <span className="f1-num f1-points">{team.points}</span>
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
