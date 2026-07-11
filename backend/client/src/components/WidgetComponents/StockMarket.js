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

  const handleStockClick = (index) => {
    setSelectedStockIndex(index);
  };

  const renderStockGraph = (data) => {
    if (!data) return null;

    const dates = Object.keys(data).slice(0, 7).reverse();
    const prices = dates.map((date) => parseFloat(data[date]['4. close']));

    const chartData = {
      labels: dates,
      datasets: [{
        label: 'Stock Price',
        data: prices,
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.4)',
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.1,
      }],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#333',
          titleColor: '#fff',
          bodyColor: '#fff',
        },
      },
      scales: {
        x: {
          ticks: { color: '#ddd' },
          grid: { color: '#444' },
        },
        y: {
          ticks: { color: '#ddd' },
          grid: { color: '#444' },
        },
      },
    };

    return (
      <div className="chart-wrapper">
        <h2 className="chart-title">Last Week Performance</h2>
        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    );
  };

  const renderStockInfo = (data, symbol) => {
    if (!data) return null;

    const latestDate = Object.keys(data)[0];
    const latestInfo = data[latestDate];

    return (
      <div
        className={`stock-item ${symbols.indexOf(symbol) === selectedStockIndex ? 'selected' : ''}`}
        onClick={() => handleStockClick(symbols.indexOf(symbol))}
      >
        <h3>{symbol}</h3>
        <p>Latest Price: ${latestInfo['4. close']}</p>
        <p>High: ${latestInfo['2. high']}</p>
        <p>Low: ${latestInfo['3. low']}</p>
        <p>Volume: {latestInfo['5. volume']}</p>
      </div>
    );
  };

  if (loading) {
    return <div className="stock-market-widget">Loading stocks...</div>;
  }

  return (
    <div className="stock-market-widget">
      <div className="stock-list">
        {stocks.map((stock, index) => (
          <div key={symbols[index]}>
            {renderStockInfo(stock, symbols[index])}
          </div>
        ))}
      </div>
      <div className="stock-graph">
        {renderStockGraph(stocks[selectedStockIndex])}
      </div>
    </div>
  );
}

export default StockMarket;
