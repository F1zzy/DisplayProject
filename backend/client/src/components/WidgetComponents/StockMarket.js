import React, { useState, useEffect } from 'react';
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
} from 'chart.js';
import { getStocks } from '../../api/client';
import './StockMarket.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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

function StockMarket() {
  const [stocks, setStocks] = useState([]);
  const [selectedStockIndex, setSelectedStockIndex] = useState(0);
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllStocks = async () => {
      try {
        const result = await getStocks(['AAPL', 'GOOGL', 'MSFT']);
        setSymbols(result.symbols);
        setStocks(result.data);
      } catch (error) {
        console.error('Error fetching stock data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllStocks();
  }, []);

  const selectedSymbol = symbols[selectedStockIndex];
  const selectedData = stocks[selectedStockIndex];

  const renderStockGraph = (data, symbol) => {
    if (!data) {
      return (
        <div className="stock-chart-empty">
          <p>No chart data for {symbol}</p>
        </div>
      );
    }

    const dates = Object.keys(data).slice(0, 7).reverse();
    const prices = dates.map((date) => parseFloat(data[date]['4. close']));

    const chartData = {
      labels: dates.map(formatChartDate),
      datasets: [{
        label: 'Close',
        data: prices,
        fill: true,
        backgroundColor: 'rgba(3, 102, 214, 0.15)',
        borderColor: '#58a6ff',
        borderWidth: 2,
        pointBackgroundColor: '#58a6ff',
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
      }],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f1f1f',
          titleColor: '#fff',
          bodyColor: '#ddd',
          borderColor: '#444',
          borderWidth: 1,
          callbacks: {
            label: (context) => `$${context.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#aaa', maxRotation: 0 },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
        },
        y: {
          ticks: {
            color: '#aaa',
            callback: (value) => `$${value}`,
          },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
        },
      },
    };

    return (
      <div className="chart-wrapper">
        <div className="chart-header">
          <h2 className="chart-title">{symbol} — Last 7 Days</h2>
          <span className="chart-price">${formatPrice(prices[prices.length - 1])}</span>
        </div>
        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    );
  };

  const renderStockInfo = (data, symbol, index) => {
    if (!data) {
      return (
        <button
          type="button"
          className={`stock-item stock-item--empty ${index === selectedStockIndex ? 'selected' : ''}`}
          onClick={() => setSelectedStockIndex(index)}
        >
          <span className="stock-symbol">{symbol}</span>
          <span className="stock-unavailable">Unavailable</span>
        </button>
      );
    }

    const latestDate = Object.keys(data)[0];
    const latestInfo = data[latestDate];
    const previousDate = Object.keys(data)[1];
    const previousClose = previousDate ? parseFloat(data[previousDate]['4. close']) : null;
    const latestClose = parseFloat(latestInfo['4. close']);
    const change = previousClose ? latestClose - previousClose : 0;
    const changePct = previousClose ? (change / previousClose) * 100 : 0;
    const isUp = change >= 0;

    return (
      <button
        type="button"
        className={`stock-item ${index === selectedStockIndex ? 'selected' : ''}`}
        onClick={() => setSelectedStockIndex(index)}
      >
        <div className="stock-item-header">
          <span className="stock-symbol">{symbol}</span>
          <span className={`stock-change ${isUp ? 'stock-change--up' : 'stock-change--down'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <div className="stock-price">${formatPrice(latestInfo['4. close'])}</div>
        <div className="stock-stats">
          <div className="stock-stat">
            <span className="stock-stat-label">High</span>
            <span className="stock-stat-value">${formatPrice(latestInfo['2. high'])}</span>
          </div>
          <div className="stock-stat">
            <span className="stock-stat-label">Low</span>
            <span className="stock-stat-value">${formatPrice(latestInfo['3. low'])}</span>
          </div>
          <div className="stock-stat stock-stat--wide">
            <span className="stock-stat-label">Volume</span>
            <span className="stock-stat-value">{formatVolume(latestInfo['5. volume'])}</span>
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="stock-market-widget stock-market-widget--loading">
        <div className="stock-loading">Loading stocks...</div>
      </div>
    );
  }

  return (
    <div className="stock-market-widget">
      <aside className="stock-list">
        <h2 className="stock-list-title">Markets</h2>
        {stocks.map((stock, index) => (
          <div key={symbols[index]}>
            {renderStockInfo(stock, symbols[index], index)}
          </div>
        ))}
      </aside>
      <section className="stock-graph">
        {renderStockGraph(selectedData, selectedSymbol)}
      </section>
    </div>
  );
}

export default StockMarket;
