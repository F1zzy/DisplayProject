import React from 'react';

function Timetable({ data }) {
  if (!data) return <div>Loading...</div>;
  return (
    <div className="timetable">
      <h2>Timetable</h2>
      <p>{data}</p>
    </div>
  );
}

export default Timetable;
