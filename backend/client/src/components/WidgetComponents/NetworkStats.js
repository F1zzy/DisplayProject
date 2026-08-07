import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getNetworkStats } from '../../api/client';
import { usePollingFetch } from '../../hooks/usePollingFetch';
import LoadingState from '../ui/LoadingState';
import ErrorState from '../ui/ErrorState';
import { LiveLineChart } from '../charts/live-line-chart';
import { LiveLine } from '../charts/live-line';
import { LiveXAxis } from '../charts/live-x-axis';
import { LiveYAxis } from '../charts/live-y-axis';
import './NetworkStats.css';

const HISTORY_MAX = 24;
const POLL_MS = 15000;
/** ~20 samples at 15s ≈ 5 minutes (LiveLine window is seconds). */
const LIVE_WINDOW_SECS = 20 * (POLL_MS / 1000);

function formatRate(bps) {
  if (bps == null || Number.isNaN(bps)) return '—';
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatSats(value) {
  return formatRate(value);
}

function formatCheckedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function NetworkStats() {
  const [history, setHistory] = useState([]);
  const fetchStats = useCallback(() => getNetworkStats(), []);
  const { data: stats, loading, error } = usePollingFetch(fetchStats, {
    intervalMs: POLL_MS,
  });

  useEffect(() => {
    if (!stats) return;
    setHistory((prev) => {
      const point = {
        at: stats.checkedAt || new Date().toISOString(),
        rxBps: stats.rxBps,
        txBps: stats.txBps,
        latencyMs: stats.latencyMs,
      };
      const last = prev[prev.length - 1];
      if (last && last.at === point.at) {
        return prev;
      }
      return [...prev, point].slice(-HISTORY_MAX);
    });
  }, [stats]);

  const liveSeries = useMemo(() => {
    const data = history
      .filter((point) => point.rxBps != null && !Number.isNaN(point.rxBps))
      .map((point) => ({
        time: Math.floor(new Date(point.at).getTime() / 1000),
        value: point.rxBps,
      }));
    const value =
      data.length > 0
        ? data[data.length - 1].value
        : stats?.rxBps != null
          ? stats.rxBps
          : 0;
    return { data, value };
  }, [history, stats]);

  const showChart = liveSeries.data.length > 0;
  const online = stats?.online === true;

  return (
    <div className="widget-content network-stats-widget">
      <h3>Network</h3>

      {loading && !stats && <LoadingState>Checking connection…</LoadingState>}

      {!loading && error && !stats && (
        <ErrorState className="network-empty">{error || 'Unable to load network stats'}</ErrorState>
      )}

      {!loading && stats && (
        <>
          <div className="network-status-row">
            <span
              className={`network-badge ${online ? 'network-badge--online' : 'network-badge--offline'}`}
            >
              {online ? 'Online' : 'Offline'}
            </span>
            <span className="network-latency">
              {stats.latencyMs != null ? `${stats.latencyMs} ms` : '—'}
            </span>
          </div>

          <div className="network-rates">
            <div className="network-rate">
              <span className="network-rate-label">Download</span>
              <strong className="network-rate-value">{formatRate(stats.rxBps)}</strong>
            </div>
            <div className="network-rate">
              <span className="network-rate-label">Upload</span>
              <strong className="network-rate-value">{formatRate(stats.txBps)}</strong>
            </div>
          </div>

          <div className="network-chart">
            {showChart ? (
              <LiveLineChart
                className="network-bklit-chart"
                data={liveSeries.data}
                value={liveSeries.value}
                window={LIVE_WINDOW_SECS}
                nowOffsetUnits={1}
                margin={{ top: 12, right: 88, bottom: 40, left: 8 }}
                style={{ height: '100%', width: '100%' }}
              >
                <LiveLine
                  dataKey="value"
                  stroke="var(--chart-3)"
                  formatValue={formatSats}
                  dotSize={4}
                />
                <LiveXAxis />
                <LiveYAxis position="left" formatValue={formatSats} />
              </LiveLineChart>
            ) : (
              <p className="network-chart-empty">
                Graph will appear after the next samples
              </p>
            )}
          </div>

          <div className="network-meta">
            {stats.interface ? (
              <span>Interface {stats.interface}</span>
            ) : (
              <span>Traffic rates unavailable on this host</span>
            )}
            {stats.checkedAt ? <span>Checked {formatCheckedAt(stats.checkedAt)}</span> : null}
          </div>

          {!online && stats.lastOnlineAt ? (
            <p className="network-downtime">
              Last online {formatCheckedAt(stats.lastOnlineAt)}
            </p>
          ) : null}

          <p className="network-footer">Sampled every ~15s · no speed test</p>
        </>
      )}
    </div>
  );
}

export default NetworkStats;
