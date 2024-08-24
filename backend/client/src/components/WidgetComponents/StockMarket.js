import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import './StockMarket.css';

async function fetchStockData(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch stock data");
    }
    const data = await response.json();
    return data["Time Series (Daily)"];
  } catch (error) {
    console.error("Error fetching stock data:", error);
    return null;
  }
}

function StockMarket() {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllStockData = async () => {
      const apiKey = process.env.REACT_APP_STOCK_API_KEY;
      const symbols = ['AAPL', 'GOOGL', 'AMZN']; // Add more symbols if needed
      const stockDataPromises = symbols.map(symbol => fetchStockData(symbol, apiKey));
      
      const results = await Promise.all(stockDataPromises);
      setStockData(results);
      setLoading(false);
    };

    fetchAllStockData();
  }, []);

  if (loading) {
    return <div className="loading">Loading stock data...</div>;
  }

  const formatDataForChart = (data) => {
    const labels = Object.keys(data).reverse().slice(0, 30); // Last 30 days
    const prices = labels.map(label => parseFloat(data[label]["4. close"]));

    return {
      labels,
      datasets: [
        {
          label: 'Stock Price',
          data: prices,
          fill: false,
          backgroundColor: 'rgba(75,192,192,0.2)',
          borderColor: 'rgba(75,192,192,1)',
        },
      ],
    };
  };

  return (
    <div className="stock-widget">
      {stockData.map((data, index) => {
        const symbol = ['AAPL', 'GOOGL', 'AMZN'][index]; // Match the symbol order with the data
        const chartData = formatDataForChart(data);

        return (
          <div key={symbol} className="stock-chart-container">
            <h3>{symbol}</h3>
            <Line data={chartData} />
          </div>
        );
      })}
    </div>
  );
}

export default StockMarket;
