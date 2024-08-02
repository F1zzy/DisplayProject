import React, { useEffect, useState } from 'react';
import './App.css';
import Timetable from './components/Timetable';
import News from './components/News';
import ValorantStats from './components/ValorantStats';

function App() {
  const [timetable, setTimetable] = useState(null);
  const [news, setNews] = useState(null);
  const [valorantStats, setValorantStats] = useState(null);

  useEffect(() => {
    fetch('/api/timetable')
      .then(response => response.json())
      .then(data => setTimetable(data.timetable));
    
    fetch('/api/news')
      .then(response => response.json())
      .then(data => setNews(data.articles));
    
    fetch('/api/valorant-stats')
      .then(response => response.json())
      .then(data => setValorantStats(data.stats));
  }, []);

  return (
    <div className="App">
      <h1>My Dashboard</h1>
      <Timetable data={timetable} />
      <News articles={news} />
      <ValorantStats stats={valorantStats} />
    </div>
  );
}

export default App;
