import React, { useState, useEffect } from 'react';
import { getNetworkStats } from '../../api/client';
import './NetworkStats.css';

function formatRate(bps) {
  if (bps == null || Number.isNaN(bps)) return '—';
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatCheckedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function NetworkStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getNetworkStats();
        if (cancelled) return;
        setStats(data);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Unable to load network stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const online = stats?.online === true;

  return (
    <div className="widget-content network-stats-widget">
      <h3>Network</h3>

      {loading && <p className="widget-loading">Checking connection…</p>}

      {!loading && error && <p className="network-empty">{error}</p>}

      {!loading && !error && stats && (
        <>
          <div className="network-status-row">
            <span className={`network-badge ${online ? 'network-badge--online' : 'network-badge--offline'}`}>
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
