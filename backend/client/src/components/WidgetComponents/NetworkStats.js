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

const HISTORY_MAX = 12;
const POLL_MS = 15000;
/** Match HISTORY_MAX samples at the poll interval (LiveLine window is seconds). */
const LIVE_WINDOW_SECS = HISTORY_MAX * (POLL_MS / 1000);

const TARGET_LABELS = {
  internet: 'Internet',
  gateway: 'Gateway',
  dns: 'DNS',
};

function formatRate(bps) {
  if (bps == null || Number.isNaN(bps)) return '—';
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatMs(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)} ms`;
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

function toLatencyPoints(history) {
  return history
    .filter((point) => point.latencyMs != null && !Number.isNaN(point.latencyMs))
    .map((point) => ({
      time: Math.floor(new Date(point.at).getTime() / 1000),
      value: point.latencyMs,
    }));
}

function NetworkStats() {
  const [history, setHistory] = useState([]);
  const fetchStats = useCallback(() => getNetworkStats(), []);
  const { data: stats, loading, error } = usePollingFetch(fetchStats, {
    intervalMs: POLL_MS,
  });

  useEffect(() => {
    if (!stats) return;

    if (Array.isArray(stats.history) && stats.history.length > 0) {
      setHistory(stats.history.slice(-HISTORY_MAX));
      return;
    }

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

  const trafficSeries = useMemo(() => {
    const data = history
      .filter(
        (point) =>
          (point.rxBps != null && !Number.isNaN(point.rxBps)) ||
          (point.txBps != null && !Number.isNaN(point.txBps))
      )
      .map((point) => ({
        time: Math.floor(new Date(point.at).getTime() / 1000),
        download: point.rxBps != null ? point.rxBps : 0,
        upload: point.txBps != null ? point.txBps : 0,
      }));
    const download =
      data.length > 0
        ? data[data.length - 1].download
        : stats?.rxBps != null
          ? stats.rxBps
          : 0;
    return { data, download };
  }, [history, stats]);

  const latencySeries = useMemo(() => {
    const data = toLatencyPoints(history);
    const value =
      data.length > 0
        ? data[data.length - 1].value
        : stats?.latencyMs != null
          ? stats.latencyMs
          : 0;
    return { data, value };
  }, [history, stats]);

  const targets = useMemo(() => {
    const rows = Array.isArray(stats?.targets) ? stats.targets : [];
    const maxMs = Math.max(
      1,
      ...rows.map((row) => (row.latencyMs != null ? row.latencyMs : 0))
    );
    return rows.map((row) => ({
      name: TARGET_LABELS[row.name] || row.name,
      latencyMs: row.latencyMs,
      pct:
        row.latencyMs == null ? 0 : Math.max(8, Math.round((row.latencyMs / maxMs) * 100)),
    }));
  }, [stats]);

  const online = stats?.online === true;
  const showTrafficChart = trafficSeries.data.length > 0;
  const showLatencyChart = latencySeries.data.length > 0;
  const statusLabel = online ? 'Connected' : 'Disconnected';
  const statusDetail = online
    ? stats.latencyMs != null
      ? `${stats.latencyMs} ms round-trip`
      : 'Probe OK'
    : stats.lastOnlineAt
      ? `Last seen ${formatCheckedAt(stats.lastOnlineAt)}`
      : 'No route to internet probe';

  return (
    <div className="widget-content network-stats-widget">
      <h3>Network</h3>

      {loading && !stats && <LoadingState>Checking connection…</LoadingState>}

      {!loading && error && !stats && (
        <ErrorState className="network-empty">{error || 'Unable to load network stats'}</ErrorState>
      )}

      {!loading && stats && (
        <>
          <div className="network-status-card">
            <div className="network-status-main">
              <span
                className={`network-status-pill ${
                  online ? 'network-status-pill--up' : 'network-status-pill--down'
                }`}
              >
                <span className="network-status-dot" aria-hidden="true" />
                {statusLabel}
              </span>
              <span className="network-latency">
                {stats.latencyMs != null ? `${stats.latencyMs} ms` : '—'}
              </span>
            </div>
            <p className="network-status-detail">{statusDetail}</p>
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

          <div className="network-identity">
            <div className="network-identity-item">
              <span className="network-identity-label">Public IP</span>
              <strong className="network-identity-value">{stats.publicIp || '—'}</strong>
            </div>
            <div className="network-identity-item">
              <span className="network-identity-label">Gateway</span>
              <strong className="network-identity-value">{stats.gateway || '—'}</strong>
            </div>
            <div className="network-identity-item">
              <span className="network-identity-label">Local</span>
              <strong className="network-identity-value">
                {stats.ipv4 || stats.interface || '—'}
              </strong>
            </div>
          </div>

          <div className="network-chart-stack">
            <section className="network-chart-panel">
              <div className="network-chart-header">
                <h4 className="network-chart-title">Traffic</h4>
                <div className="network-chart-legend" role="list">
                  <span className="network-legend-item" role="listitem">
                    <span
                      className="network-legend-swatch network-legend-swatch--download"
                      aria-hidden="true"
                    />
                    Down {formatRate(stats.rxBps)}
                  </span>
                  <span className="network-legend-item" role="listitem">
                    <span
                      className="network-legend-swatch network-legend-swatch--upload"
                      aria-hidden="true"
                    />
                    Up {formatRate(stats.txBps)}
                  </span>
                </div>
              </div>
              <div className="network-chart">
                {showTrafficChart ? (
                  <LiveLineChart
                    className="network-bklit-chart"
                    data={trafficSeries.data}
                    value={trafficSeries.download}
                    dataKey="download"
                    window={LIVE_WINDOW_SECS}
                    nowOffsetUnits={1}
                    margin={{ top: 10, right: 88, bottom: 32, left: 6 }}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <LiveLine
                      dataKey="download"
                      stroke="var(--chart-3)"
                      formatValue={formatRate}
                      dotSize={4}
                      fill
                    />
                    <LiveLine
                      dataKey="upload"
                      stroke="var(--chart-2)"
                      formatValue={formatRate}
                      dotSize={3}
                      fill={false}
                      badge={false}
                    />
                    <LiveXAxis />
                    <LiveYAxis position="left" formatValue={formatRate} />
                  </LiveLineChart>
                ) : (
                  <p className="network-chart-empty">Waiting for rate samples…</p>
                )}
              </div>
            </section>

            <section className="network-chart-panel">
              <div className="network-chart-header">
                <h4 className="network-chart-title">Latency</h4>
                <span className="network-chart-value">{formatMs(stats.latencyMs)}</span>
              </div>
              <div className="network-chart network-chart--latency">
                {showLatencyChart ? (
                  <LiveLineChart
                    className="network-bklit-chart"
                    data={latencySeries.data}
                    value={latencySeries.value}
                    window={LIVE_WINDOW_SECS}
                    nowOffsetUnits={1}
                    margin={{ top: 10, right: 72, bottom: 32, left: 6 }}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <LiveLine
                      dataKey="value"
                      stroke="var(--chart-1, var(--accent))"
                      formatValue={formatMs}
                      dotSize={4}
                    />
                    <LiveXAxis />
                    <LiveYAxis position="left" formatValue={formatMs} />
                  </LiveLineChart>
                ) : (
                  <p className="network-chart-empty">Waiting for latency samples…</p>
                )}
              </div>
            </section>
          </div>

          {targets.length > 0 ? (
            <section className="network-targets">
              <h4 className="network-chart-title">Probe targets</h4>
              <div className="network-targets-list">
                {targets.map((target) => (
                  <div key={target.name} className="network-target">
                    <div className="network-target-meta">
                      <span className="network-target-name">{target.name}</span>
                      <span className="network-target-ms">{formatMs(target.latencyMs)}</span>
                    </div>
                    <div className="network-target-track" aria-hidden="true">
                      <span
                        className={`network-target-fill${
                          target.latencyMs == null ? ' network-target-fill--miss' : ''
                        }`}
                        style={{ width: `${target.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="network-meta">
            {stats.interface ? (
              <span>
                Interface {stats.interface}
                {stats.ipv4 ? ` · ${stats.ipv4}` : ''}
              </span>
            ) : (
              <span>Traffic rates unavailable on this host</span>
            )}
            {stats.checkedAt ? <span>Checked {formatCheckedAt(stats.checkedAt)}</span> : null}
          </div>

          <p className="network-footer">Sampled every ~15s · Bklit live charts · no speed test</p>
        </>
      )}
    </div>
  );
}

export default NetworkStats;
