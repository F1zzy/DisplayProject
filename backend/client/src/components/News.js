import React from 'react';

function News({ articles }) {
  if (!articles) return <div>Loading...</div>;
  return (
    <div className="news">
      <h2>Latest News</h2>
      <ul>
        {articles.map((article, index) => (
          <li key={index}>
            <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default News;
