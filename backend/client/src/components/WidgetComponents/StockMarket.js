import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { getStocks } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { getChartFontFamily } from '../../utils/dashboardAppearance';
import './StockMarket.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.color = '#8a8c92';

/** How long each symbol stays featured before rotating (kiosk, non-interactive). */
const STOCK_ROTATE_MS = 8000;

function formatPrice(value) {
  return Number.parseFloat(value).toFixed(2);
}

function formatVolume(value) {
  return Number.parseInt(value, 10).toLocaleString();
}

function formatChartDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
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

function StockMarket() {
  const { settings } = useSettings();
  const symbolsKey = (settings.stockSymbols || []).join(',');
  const [stocks, setStocks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const chart = useMemo(() => {
    if (!selectedData) return null;

    const dates = Object.keys(selectedData).slice(0, 7).reverse();
    const prices = dates.map((date) => parseFloat(selectedData[date]['4. close']));
    const chartFont = getChartFontFamily(settings.fontPreset);

    return {
      data: {
        labels: dates.map(formatChartDate),
        datasets: [
          {
            label: 'Close',
            data: prices,
            fill: true,
            backgroundColor: 'rgba(255, 106, 26, 0.15)',
            borderColor: '#ff6a1a',
            borderWidth: 2,
            pointBackgroundColor: '#ff6a1a',
            pointBorderColor: '#1a1c21',
            pointRadius: 3,
            pointHoverRadius: 3,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            ticks: { color: '#aaa', maxRotation: 0, font: { family: chartFont, size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
          },
          y: {
            ticks: {
              color: '#aaa',
              font: { family: chartFont, size: 11 },
              callback: (value) => `$${value}`,
            },
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
          },
        },
      },
      lastPrice: prices[prices.length - 1],
    };
  }, [selectedData, settings.fontPreset]);

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
          {chart ? (
            <div className="chart-wrapper">
              <div className="chart-header">
                <h3 className="chart-title">Last 7 Days</h3>
                <span className="chart-price">${formatPrice(chart.lastPrice)}</span>
              </div>
              <div className="chart-container">
                <Line data={chart.data} options={chart.options} />
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
