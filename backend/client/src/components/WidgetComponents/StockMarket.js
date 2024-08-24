import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

async function fetchStockData(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
  try {
    const response = await axios.get(url);
    const data = response.data['Time Series (Daily)'];
    return data;
  } catch (error) {
    console.error("Error fetching stock data:", error);
    return null;
  }
}

function StockMarket() {
  const [stocks, setStocks] = useState([]);
  const [selectedStockIndex, setSelectedStockIndex] = useState(0);

  const symbols = ['AAPL', 'GOOGL', 'MSFT']; // Top 3 stocks you want to display

  useEffect(() => {
    const fetchAllStocks = async () => {
      const apiKey = process.env.REACT_APP_STOCK_API_KEY;
      const stockData = await Promise.all(symbols.map(symbol => fetchStockData(symbol, apiKey)));
      setStocks(stockData);
    };

    fetchAllStocks();
  }, []);

  const handleStockClick = (index) => {
    setSelectedStockIndex(index);
  };

  const renderStockGraph = (data) => {
    if (!data) return null;

    const dates = Object.keys(data).slice(0, 7).reverse();
    const prices = dates.map(date => parseFloat(data[date]['4. close']));

    const chartData = {
      labels: dates,
      datasets: [{
        label: 'Stock Price',
        data: prices,
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.4)',
        borderColor: 'rgba(75,192,192,1)',
        tension: 0.1
      }]
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#333',
          titleColor: '#fff',
          bodyColor: '#fff',
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#ddd',
          },
          grid: {
            color: '#444',
          },
        },
        y: {
          ticks: {
            color: '#ddd',
          },
          grid: {
            color: '#444',
          },
        }
      }
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
      <div className={`stock-item ${symbols.indexOf(symbol) === selectedStockIndex ? 'selected' : ''}`}
           onClick={() => handleStockClick(symbols.indexOf(symbol))}>
        <h3>{symbol}</h3>
        <p>Latest Price: ${latestInfo['4. close']}</p>
        <p>High: ${latestInfo['2. high']}</p>
        <p>Low: ${latestInfo['3. low']}</p>
        <p>Volume: {latestInfo['5. volume']}</p>
      </div>
    );
  };

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
