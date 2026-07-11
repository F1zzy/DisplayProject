import React from 'react';
import './TimeTable.css';

const DEFAULT_SCHEDULE = [
  { time: '09:00', title: 'Morning standup', location: 'Remote' },
  { time: '11:30', title: 'Project review', location: 'Office' },
  { time: '14:00', title: 'Design sync', location: 'Teams' },
  { time: '16:30', title: 'Wrap-up', location: 'Remote' },
];

function Timetable() {
  const now = new Date();
  const todayLabel = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="widget-content timetable-widget">
      <h3>Today&apos;s Schedule</h3>
      <p className="timetable-date">{todayLabel}</p>
      <ul className="timetable-list">
        {DEFAULT_SCHEDULE.map((item) => (
          <li key={item.time} className="timetable-item">
            <span className="timetable-time">{item.time}</span>
            <div>
              <strong>{item.title}</strong>
              <span className="timetable-location">{item.location}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Timetable;
