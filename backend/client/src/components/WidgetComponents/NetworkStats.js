import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { getNetworkStats } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { getChartFontFamily } from '../../utils/dashboardAppearance';
import { usePollingFetch } from '../../hooks/usePollingFetch';
import LoadingState from '../ui/LoadingState';
import ErrorState from '../ui/ErrorState';
import './NetworkStats.css';

const HISTORY_MAX = 24;
const POLL_MS = 15000;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

function formatRate(bps) {
  if (bps == null || Number.isNaN(bps)) return '—';
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatRateTick(bps) {
  if (bps == null || Number.isNaN(bps)) return '';
  if (bps < 1024) return `${Math.round(bps)} B`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} K`;
  return `${(bps / (1024 * 1024)).toFixed(1)} M`;
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

function formatChartTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function NetworkStats() {
  const { settings } = useSettings();
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

  const hasRateHistory = history.some(
    (point) => point.rxBps != null || point.txBps != null
  );
  const hasLatencyHistory = history.some((point) => point.latencyMs != null);
  const showTrafficChart = hasRateHistory;
  const showChart = showTrafficChart || hasLatencyHistory;

  const chartData = useMemo(() => {
    const labels = history.map((point) => formatChartTime(point.at));

    if (showTrafficChart) {
      return {
        labels,
        datasets: [
          {
            label: 'Download',
            data: history.map((point) => point.rxBps),
            borderColor: '#ff6a1a',
            backgroundColor: 'rgba(255, 106, 26, 0.12)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: '#ff6a1a',
            tension: 0.35,
            fill: true,
            spanGaps: true,
          },
          {
            label: 'Upload',
            data: history.map((point) => point.txBps),
            borderColor: '#3ddc97',
            backgroundColor: 'rgba(61, 220, 151, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: '#3ddc97',
            tension: 0.35,
            fill: true,
            spanGaps: true,
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        {
          label: 'Latency',
          data: history.map((point) => point.latencyMs),
          borderColor: '#ff6a1a',
          backgroundColor: 'rgba(255, 106, 26, 0.12)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#ff6a1a',
          tension: 0.35,
          fill: true,
          spanGaps: true,
        },
      ],
    };
  }, [history, showTrafficChart]);

  const chartOptions = useMemo(() => {
    const chartFont = getChartFontFamily(settings.fontPreset);
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#8a8c92',
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            font: { family: chartFont, size: 11 },
          },
        },
        tooltip: {
          backgroundColor: '#1f1f1f',
          titleColor: '#fff',
          bodyColor: '#ddd',
          borderColor: '#444',
          borderWidth: 1,
          titleFont: { family: chartFont },
          bodyFont: { family: chartFont },
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              if (context.dataset.label === 'Latency') {
                return `Latency: ${value == null ? '—' : `${value} ms`}`;
              }
              return `${context.dataset.label}: ${formatRate(value)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#8a8c92',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            font: { family: chartFont, size: 10 },
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#8a8c92',
            font: { family: chartFont, size: 10 },
            callback: (value) =>
              showTrafficChart ? formatRateTick(value) : `${value} ms`,
          },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
        },
      },
    };
  }, [showTrafficChart, settings.fontPreset]);

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
              <Line data={chartData} options={chartOptions} />
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
