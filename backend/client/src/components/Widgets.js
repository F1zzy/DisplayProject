import React, { useState, useEffect } from 'react';
import './Widgets.css';
import News from './WidgetComponents/News';
import Timetable from './WidgetComponents/TimeTable';
import StockMarket from './WidgetComponents/StockMarket';

function Widgets() {
  const [currentWidget, setCurrentWidget] = useState(0);
  const widgetComponents = [

<StockMarket key="stock" />
  ];

  useEffect(() => {
    // Rotate widgets every 2 minutes (120,000 milliseconds)
    const interval = setInterval(() => {
      setCurrentWidget((prevWidget) => (prevWidget + 1) % widgetComponents.length);
    }, 120000); // 120000ms = 2 minutes

    return () => clearInterval(interval); // Cleanup on component unmount
  }, [widgetComponents.length]);

  return (
    <div className="Wid-container">
      <div className="widget-display">
        {widgetComponents[currentWidget]}
      </div>
    </div>
  );
}

export default Widgets;
