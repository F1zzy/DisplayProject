import React, { useState, useEffect } from 'react';
import './Widgets.css';
import News from './WidgetComponents/News';
import Timetable from './WidgetComponents/TimeTable';
import StockMarket from './WidgetComponents/StockMarket';

const WIDGET_COMPONENTS = [
  { key: 'stock', Component: StockMarket },
  { key: 'news', Component: News },
  { key: 'timetable', Component: Timetable },
];

function Widgets({ forcedWidget, onWidgetShown }) {
  const [currentWidget, setCurrentWidget] = useState(0);

  useEffect(() => {
    if (forcedWidget !== null && forcedWidget !== undefined) {
      setCurrentWidget(forcedWidget);
      onWidgetShown?.();
    }
  }, [forcedWidget, onWidgetShown]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWidget((prevWidget) => (prevWidget + 1) % WIDGET_COMPONENTS.length);
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  const { Component } = WIDGET_COMPONENTS[currentWidget];

  return (
    <div className="Wid-container">
      <div className="widget-display">
        <Component key={WIDGET_COMPONENTS[currentWidget].key} />
      </div>
    </div>
  );
}

export default Widgets;
