import React from 'react';

function ValorantStats({ stats }) {
  if (!stats) return <div>Loading...</div>;
  return (
    <div className="valorant-stats">
      <h2>Valorant Stats</h2>
      <p>{stats}</p>
    </div>
  );
}

export default ValorantStats;
