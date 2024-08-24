import React, { useState, useEffect } from 'react';
import './News.css';

async function fetchNews(category, apiKey) {
    let url = '';

    if (category === 'general') {
        url = `https://newsapi.org/v2/top-headlines?sources=bbc-news&apiKey=${apiKey}`;
    } else {
        url = `https://newsapi.org/v2/top-headlines?q=technology&apiKey=${apiKey}`;
    }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch news");
    }
    const data = await response.json();
    return data.articles;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

function News() {
  const [generalNews, setGeneralNews] = useState([]);
  const [techNews, setTechNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllNews = async () => {
      const apiKey = process.env.REACT_APP_NEWS_API_KEY;

      const [general, tech] = await Promise.all([
        fetchNews('general', apiKey),
        fetchNews('technology', apiKey)
      ]);

      setGeneralNews(general);
      setTechNews(tech);
      setLoading(false);
    };

    fetchAllNews();
  }, []);

  if (loading) {
    return <div className="loading">Loading news...</div>;
  }

  const renderNewsItem = (article) => (
    <div className="news-item" key={article.url}>
    <img src={article.urlToImage || 'ERROR'} className="news-image" />
      <div className="news-content">
        <h4 className="news-title">{article.title}</h4>
        <p className="news-description">{article.description}</p>
      </div>
    </div>
  );

  return (
    <div className="news-widget">
      <div className="news-section">
        <h3 className="news-section-title">Top Headlines</h3>
        <div className="news-list">
          {generalNews.slice(0, 3).map(renderNewsItem)}
        </div>
      </div>

      <div className="news-section">
        <h3 className="news-section-title">Technology News</h3>
        <div className="news-list">
          {techNews.slice(0, 2).map(renderNewsItem)}
        </div>
      </div>
    </div>
  );
}

export default News;
