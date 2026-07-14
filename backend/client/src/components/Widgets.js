import React, { useState, useEffect, useMemo } from 'react';
import './Widgets.css';
import News from './WidgetComponents/News';
import Timetable from './WidgetComponents/TimeTable';
import StockMarket from './WidgetComponents/StockMarket';
import NetworkStats from './WidgetComponents/NetworkStats';
import { useSettings } from '../context/SettingsContext';

const WIDGET_REGISTRY = {
  stock: { key: 'stock', label: 'Stocks', Component: StockMarket },
  news: { key: 'news', label: 'News', Component: News },
  timetable: { key: 'timetable', label: 'Schedule', Component: Timetable },
  network: { key: 'network', label: 'Network', Component: NetworkStats },
};

function Widgets({ forcedWidget, onWidgetShown }) {
  const { settings } = useSettings();
  const widgets = useMemo(() => {
    const enabled = Array.isArray(settings.enabledWidgets) ? settings.enabledWidgets : [];
    const list = enabled
      .map((key) => WIDGET_REGISTRY[key])
      .filter(Boolean);
    return list.length > 0 ? list : Object.values(WIDGET_REGISTRY);
  }, [settings.enabledWidgets]);

  const rotationMs = settings.widgetRotationMs ?? 120000;
  const [currentWidget, setCurrentWidget] = useState(0);

  useEffect(() => {
    setCurrentWidget((prev) => (prev >= widgets.length ? 0 : prev));
  }, [widgets.length]);

  useEffect(() => {
    if (forcedWidget !== null && forcedWidget !== undefined) {
      setCurrentWidget(forcedWidget % widgets.length);
      onWidgetShown?.();
    }
  }, [forcedWidget, onWidgetShown, widgets.length]);

  useEffect(() => {
    if (!rotationMs || rotationMs <= 0 || widgets.length < 2) {
      return undefined;
    }

    const interval = setInterval(() => {
      setCurrentWidget((prevWidget) => (prevWidget + 1) % widgets.length);
    }, rotationMs);

    return () => clearInterval(interval);
  }, [rotationMs, widgets.length]);

  const activeIndex = currentWidget % widgets.length;
  const { Component, key } = widgets[activeIndex];

  return (
    <div className="Wid-container panel">
      <div className="widget-toolbar">
        <h2 className="widget-toolbar-title">Widgets</h2>
        <div className="widget-tabs">
          {widgets.map((widget, index) => (
            <span
              key={widget.key}
              className={`widget-tab ${index === activeIndex ? 'active' : ''}`}
            >
              {widget.label}
            </span>
          ))}
        </div>
      </div>
      <div className="widget-display">
        <Component key={key} />
      </div>
    </div>
  );
}

export default Widgets;
