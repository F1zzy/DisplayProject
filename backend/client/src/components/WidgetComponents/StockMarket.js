import React, { useState, useEffect, useMemo } from 'react';
import { getStocks } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { LiveLineChart } from '../charts/live-line-chart';
import { LiveLine } from '../charts/live-line';
import { LiveXAxis } from '../charts/live-x-axis';
import { LiveYAxis } from '../charts/live-y-axis';
import { CandlestickChart } from '../charts/candlestick-chart';
import { Candlestick } from '../charts/candlestick';
import { Background } from '../charts/background';
import { ChartTooltip } from '../charts/tooltip';
import { XAxis } from '../charts/x-axis';
import './StockMarket.css';

/** How long each symbol stays featured before rotating (kiosk, non-interactive). */
const STOCK_ROTATE_MS = 8000;
const LIVE_WINDOW = 25;
const LIVE_LOOKBACK = 25;
const CANDLE_LOOKBACK = 30;

const momentumColors = {
  up: 'var(--color-emerald-500)',
  down: 'var(--color-red-500)',
  flat: 'var(--muted-foreground)',
};

function formatPrice(value) {
  return Number.parseFloat(value).toFixed(2);
}

function formatVolume(value) {
  return Number.parseInt(value, 10).toLocaleString();
}

function formatUsd(value) {
  return `$${Number(value).toFixed(2)}`;
}

function getLatestStats(data) {
  if (!data) return null;
  const dates = Object.keys(data);
  if (dates.length === 0) return null;

  const latestDate = dates[0];
  const latestInfo = data[latestDate];
  const previousDate = dates[1];
  const previousClose = previousDate ? parseFloat(data[previousDate]['4. close']) : null;
  const latestClose = parseFloat(latestInfo['4. close']);
  const change = previousClose != null ? latestClose - previousClose : 0;
  const changePct = previousClose ? (change / previousClose) * 100 : 0;

  return {
    close: latestClose,
    high: parseFloat(latestInfo['2. high']),
    low: parseFloat(latestInfo['3. low']),
    volume: latestInfo['5. volume'],
    change,
    changePct,
    isUp: change >= 0,
  };
}

function CandlestickTooltipContent({ point }) {
  const date = point.date instanceof Date ? point.date : new Date(point.date);
  const open = Number(point.open) || 0;
  const high = Number(point.high) || 0;
  const low = Number(point.low) || 0;
  const close = Number(point.close) || 0;

  return (
    <div className="px-3 py-2.5">
      <div className="mb-1.5 text-xs font-medium opacity-60" style={{ color: 'var(--chart-tooltip-foreground)' }}>
        {date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <span style={{ color: 'var(--chart-tooltip-muted)' }}>Open</span>
        <span className="tabular-nums" style={{ color: 'var(--chart-tooltip-foreground)' }}>
          {formatUsd(open)}
        </span>
        <span style={{ color: 'var(--chart-tooltip-muted)' }}>High</span>
        <span className="tabular-nums" style={{ color: 'var(--color-emerald-500)' }}>
          {formatUsd(high)}
        </span>
        <span style={{ color: 'var(--chart-tooltip-muted)' }}>Low</span>
        <span className="tabular-nums" style={{ color: 'var(--color-red-500)' }}>
          {formatUsd(low)}
        </span>
        <span style={{ color: 'var(--chart-tooltip-muted)' }}>Close</span>
        <span className="tabular-nums" style={{ color: 'var(--chart-tooltip-foreground)' }}>
          {formatUsd(close)}
        </span>
      </div>
    </div>
  );
}

function StockMarket() {
  const { settings } = useSettings();
  const symbolsKey = (settings.stockSymbols || []).join(',');
  const [stocks, setStocks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const chartMode = settings.stockChartMode === 'candles' ? 'candles' : 'line';

  useEffect(() => {
    let cancelled = false;
    const requestedSymbols = symbolsKey
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const fetchAllStocks = async () => {
      setLoading(true);
      try {
        const result = await getStocks(requestedSymbols);
        if (cancelled) return;
        setSymbols(result.symbols);
        setStocks(result.data);
        setActiveIndex(0);
      } catch (error) {
        console.error('Error fetching stock data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllStocks();
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  useEffect(() => {
    if (symbols.length <= 1) return undefined;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % symbols.length);
    }, STOCK_ROTATE_MS);

    return () => clearInterval(timer);
  }, [symbols.length]);

  const selectedSymbol = symbols[activeIndex];
  const selectedData = stocks[activeIndex];
  const stats = useMemo(() => getLatestStats(selectedData), [selectedData]);

  const chronologicalDates = useMemo(() => {
    if (!selectedData) return [];
    return Object.keys(selectedData).slice().reverse();
  }, [selectedData]);

  const liveSeries = useMemo(() => {
    if (!chronologicalDates.length) {
      return { data: [], value: 0 };
    }
    const dates = chronologicalDates.slice(-LIVE_LOOKBACK);
    const nowSec = Math.floor(Date.now() / 1000);
    const data = dates.map((dateStr, index) => ({
      time: nowSec - (dates.length - 1 - index),
      value: parseFloat(selectedData[dateStr]['4. close']),
    }));
    const value = data.length ? data[data.length - 1].value : 0;
    return { data, value };
  }, [chronologicalDates, selectedData]);

  const ohlcData = useMemo(() => {
    if (!chronologicalDates.length) return [];
    return chronologicalDates.slice(-CANDLE_LOOKBACK).map((dateStr) => {
      const bar = selectedData[dateStr];
      return {
        date: new Date(dateStr),
        open: parseFloat(bar['1. open']),
        high: parseFloat(bar['2. high']),
        low: parseFloat(bar['3. low']),
        close: parseFloat(bar['4. close']),
      };
    });
  }, [chronologicalDates, selectedData]);

  const lastPrice =
    liveSeries.data.length > 0
      ? liveSeries.data[liveSeries.data.length - 1].value
      : null;

  if (loading) {
    return (
      <div className="stock-market-widget stock-market-widget--loading">
        <div className="stock-loading">Loading stocks...</div>
      </div>
    );
  }

  if (!symbols.length) {
    return (
      <div className="stock-market-widget stock-market-widget--loading">
        <div className="stock-loading">No stocks configured</div>
      </div>
    );
  }

  const hasChartData = chartMode === 'line' ? liveSeries.data.length > 0 : ohlcData.length > 0;

  return (
    <div className="stock-market-widget" aria-live="polite">
      <div className="stock-ticker" role="list" aria-label="Stock symbols">
        {symbols.map((symbol, index) => {
          const itemStats = getLatestStats(stocks[index]);
          const isActive = index === activeIndex;
          return (
            <div
              key={symbol}
              role="listitem"
              className={`stock-ticker-item${isActive ? ' stock-ticker-item--active' : ''}${
                !itemStats ? ' stock-ticker-item--empty' : ''
              }`}
            >
              <span className="stock-ticker-symbol">{symbol}</span>
              {itemStats ? (
                <span
                  className={`stock-ticker-change ${
                    itemStats.isUp ? 'stock-ticker-change--up' : 'stock-ticker-change--down'
                  }`}
                >
                  {itemStats.isUp ? '+' : ''}
                  {itemStats.changePct.toFixed(1)}%
                </span>
              ) : (
                <span className="stock-ticker-change">—</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="stock-featured">
        <div className="stock-featured-meta">
          <div className="stock-featured-heading">
            <h2 className="stock-featured-symbol">{selectedSymbol}</h2>
            {stats ? (
              <span
                className={`stock-featured-change ${
                  stats.isUp ? 'stock-featured-change--up' : 'stock-featured-change--down'
                }`}
              >
                {stats.isUp ? '+' : ''}
                {stats.changePct.toFixed(2)}%
              </span>
            ) : null}
          </div>

          {stats ? (
            <>
              <div className="stock-featured-price">${formatPrice(stats.close)}</div>
              <div className="stock-featured-stats">
                <div className="stock-featured-stat">
                  <span className="stock-featured-stat-label">High</span>
                  <span className="stock-featured-stat-value">${formatPrice(stats.high)}</span>
                </div>
                <div className="stock-featured-stat">
                  <span className="stock-featured-stat-label">Low</span>
                  <span className="stock-featured-stat-value">${formatPrice(stats.low)}</span>
                </div>
                <div className="stock-featured-stat">
                  <span className="stock-featured-stat-label">Volume</span>
                  <span className="stock-featured-stat-value">{formatVolume(stats.volume)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="stock-featured-unavailable">Unavailable</div>
          )}

          {symbols.length > 1 ? (
            <div className="stock-rotate-progress" aria-hidden="true">
              <div
                key={activeIndex}
                className="stock-rotate-progress-fill"
                style={{ animationDuration: `${STOCK_ROTATE_MS}ms` }}
              />
            </div>
          ) : null}
        </div>

        <section className="stock-graph">
          {hasChartData ? (
            <div className="chart-wrapper">
              <div className="chart-header">
                <div className="chart-header-main">
                  <h3 className="chart-title">
                    {chartMode === 'line' ? 'Live Close' : 'OHLC'}
                  </h3>
                  <div className="chart-mode-toggle" role="status" aria-label="Chart mode">
                    <span
                      className={`chart-mode-btn${chartMode === 'line' ? ' chart-mode-btn--active' : ''}`}
                    >
                      Line
                    </span>
                    <span
                      className={`chart-mode-btn${chartMode === 'candles' ? ' chart-mode-btn--active' : ''}`}
                    >
                      Candles
                    </span>
                  </div>
                </div>
                <span className="chart-price">{formatUsd(lastPrice ?? stats?.close ?? 0)}</span>
              </div>
              <div className="chart-container">
                {chartMode === 'line' ? (
                  <LiveLineChart
                    key={selectedSymbol}
                    className="stock-bklit-chart"
                    data={liveSeries.data}
                    value={liveSeries.value}
                    window={LIVE_WINDOW}
                    nowOffsetUnits={1}
                    paused
                    margin={{ top: 12, right: 88, bottom: 40, left: 8 }}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <LiveLine
                      dataKey="value"
                      momentumColors={momentumColors}
                      formatValue={formatUsd}
                      dotSize={5}
                    />
                    <LiveXAxis />
                    <LiveYAxis position="left" formatValue={formatUsd} />
                  </LiveLineChart>
                ) : (
                  <CandlestickChart
                    key={`${selectedSymbol}-candles`}
                    className="stock-bklit-chart"
                    data={ohlcData}
                    margin={{ top: 12, right: 56, bottom: 40, left: 8 }}
                    style={{ height: '100%', width: '100%', aspectRatio: 'unset' }}
                    revealSignature={selectedSymbol}
                  >
                    <Background />
                    <Candlestick fadedOpacity={0.25} />
                    <ChartTooltip content={CandlestickTooltipContent} showDots={false} />
                    <XAxis />
                  </CandlestickChart>
                )}
              </div>
            </div>
          ) : (
            <div className="stock-chart-empty">
              <p>No chart data for {selectedSymbol}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default StockMarket;
