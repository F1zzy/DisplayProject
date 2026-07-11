import React, { useState, useEffect } from 'react';
import { getNews } from '../../api/client';
import './News.css';

function News() {
  const [generalNews, setGeneralNews] = useState([]);
  const [techNews, setTechNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllNews = async () => {
      try {
        const [general, tech] = await Promise.all([
          getNews('general'),
          getNews('technology'),
        ]);
        setGeneralNews(general);
        setTechNews(tech);
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllNews();
  }, []);

  if (loading) {
    return <div className="loading">Loading news...</div>;
  }

  const renderNewsItem = (article) => (
    <div className="news-item" key={article.url}>
      {article.urlToImage && (
        <img src={article.urlToImage} alt="" className="news-image" />
      )}
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
