import React, { useState, useEffect } from 'react';
import './Widgets.css';
import News from './WidgetComponents/News';
import Timetable from './WidgetComponents/TimeTable';
import StockMarket from './WidgetComponents/StockMarket';

const WIDGET_COMPONENTS = [
  { key: 'stock', label: 'Stocks', Component: StockMarket },
  { key: 'news', label: 'News', Component: News },
  { key: 'timetable', label: 'Schedule', Component: Timetable },
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
    <div className="Wid-container panel">
      <div className="widget-toolbar">
        <h2 className="widget-toolbar-title">Widgets</h2>
        <div className="widget-tabs">
          {WIDGET_COMPONENTS.map((widget, index) => (
            <span
              key={widget.key}
              className={`widget-tab ${index === currentWidget ? 'active' : ''}`}
            >
              {widget.label}
            </span>
          ))}
        </div>
      </div>
      <div className="widget-display">
        <Component key={WIDGET_COMPONENTS[currentWidget].key} />
      </div>
    </div>
  );
}

export default Widgets;
