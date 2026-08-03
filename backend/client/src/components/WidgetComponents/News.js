import React, { useState, useEffect } from 'react';
import { getNews } from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNewspaper, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import './News.css';

function getSourceLabel(source) {
  if (!source?.name) return 'News';
  return source.name.replace(/\s*[-–|].*$/, '').trim();
}

function getSourceInitials(name) {
  if (!name) return 'N';
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function NewsThumbnail({ article, variant = 'general' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const sourceLabel = getSourceLabel(article.source);
  const showImage = article.urlToImage && !imageFailed;

  if (showImage) {
    return (
      <img
        src={article.urlToImage}
        alt=""
        className="news-image"
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`news-image-placeholder news-image-placeholder--${variant}`}
      aria-hidden="true"
    >
      <FontAwesomeIcon
        icon={variant === 'technology' ? faMicrochip : faNewspaper}
        className="news-image-placeholder-icon"
      />
      <span className="news-image-placeholder-initials">
        {getSourceInitials(sourceLabel)}
      </span>
      <span className="news-image-placeholder-source">{sourceLabel}</span>
    </div>
  );
}

function News() {
  const { settings } = useSettings();
  const showGeneral = settings.newsGeneral !== false;
  const showTechnology = settings.newsTechnology !== false;
  const [generalNews, setGeneralNews] = useState([]);
  const [techNews, setTechNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchAllNews = async () => {
      setLoading(true);
      try {
        const tasks = [];
        if (showGeneral) tasks.push(getNews('general').then((data) => ({ type: 'general', data })));
        if (showTechnology) {
          tasks.push(getNews('technology').then((data) => ({ type: 'technology', data })));
        }

        const results = await Promise.all(tasks);
        if (cancelled) return;

        setGeneralNews(results.find((r) => r.type === 'general')?.data || []);
        setTechNews(results.find((r) => r.type === 'technology')?.data || []);
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllNews();
    return () => {
      cancelled = true;
    };
  }, [showGeneral, showTechnology]);

  if (loading) {
    return <div className="widget-loading">Loading news...</div>;
  }

  const renderNewsItem = (article, variant) => (
    <article className="news-item" key={article.url}>
      <NewsThumbnail article={article} variant={variant} />
      <div className="news-content">
        <h4 className="news-title">{article.title}</h4>
        <p className="news-description">
          {article.description || 'No summary available for this story.'}
        </p>
        {article.source?.name && (
          <span className="news-source">{getSourceLabel(article.source)}</span>
        )}
      </div>
    </article>
  );

  if (!showGeneral && !showTechnology) {
    return (
      <div className="news-widget">
        <p className="widget-empty">No news columns enabled. Turn them on in Remote settings.</p>
      </div>
    );
  }

  return (
    <div className="news-widget">
      {showGeneral && (
        <div className="news-section">
          <h3 className="news-section-title">Top Headlines</h3>
          <div className="news-list">
            {generalNews.slice(0, 3).map((article) => renderNewsItem(article, 'general'))}
          </div>
        </div>
      )}

      {showTechnology && (
        <div className="news-section">
          <h3 className="news-section-title">Technology News</h3>
          <div className="news-list">
            {techNews.slice(0, 2).map((article) => renderNewsItem(article, 'technology'))}
          </div>
        </div>
      )}
    </div>
  );
}

export default News;
