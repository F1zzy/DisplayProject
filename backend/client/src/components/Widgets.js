import React, { useState, useEffect, useMemo } from 'react';
import './Widgets.css';
import News from './WidgetComponents/News';
import Timetable from './WidgetComponents/TimeTable';
import StockMarket from './WidgetComponents/StockMarket';
import NetworkStats from './WidgetComponents/NetworkStats';
import NightSky from './WidgetComponents/NightSky';
import SpotifyNow from './WidgetComponents/SpotifyNow';
import { useSettings } from '../context/SettingsContext';

const WIDGET_REGISTRY = {
  stock: { key: 'stock', label: 'Stocks', Component: StockMarket },
  news: { key: 'news', label: 'News', Component: News },
  timetable: { key: 'timetable', label: 'Schedule', Component: Timetable },
  network: { key: 'network', label: 'Network', Component: NetworkStats },
  sky: { key: 'sky', label: 'Night Sky', Component: NightSky },
  spotify: { key: 'spotify', label: 'Spotify', Component: SpotifyNow },
};

function ToolbarContent({ widgets, activeIndex, pinned }) {
  return (
    <>
      <h2 className="widget-toolbar-title">
        Widgets{pinned ? <span className="widget-pinned-badge">Pinned</span> : null}
      </h2>
      <div className="widget-tabs" role="tablist" aria-label="Active widget">
        {widgets.map((widget, index) => (
          <span
            key={widget.key}
            className={`widget-tab ${index === activeIndex ? 'active' : ''}`}
            role="tab"
            aria-selected={index === activeIndex}
          >
            {widget.label}
          </span>
        ))}
      </div>
    </>
  );
}

function Widgets({ forcedWidget, onWidgetShown, pinned = false }) {
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
  const [cycleId, setCycleId] = useState(0);
  const timerActive = rotationMs > 0 && widgets.length > 1 && !pinned;

  useEffect(() => {
    setCurrentWidget((prev) => (prev >= widgets.length ? 0 : prev));
  }, [widgets.length]);

  useEffect(() => {
    if (forcedWidget !== null && forcedWidget !== undefined) {
      setCurrentWidget(forcedWidget % widgets.length);
      setCycleId((id) => id + 1);
      onWidgetShown?.();
    }
  }, [forcedWidget, onWidgetShown, widgets.length]);

  useEffect(() => {
    if (!timerActive) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setCurrentWidget((prevWidget) => (prevWidget + 1) % widgets.length);
      setCycleId((id) => id + 1);
    }, rotationMs);

    return () => clearTimeout(timeout);
  }, [rotationMs, widgets.length, timerActive, cycleId]);

  const activeIndex = currentWidget % widgets.length;
  const { Component, key } = widgets[activeIndex];

  return (
    <div className="Wid-container panel">
      <div className="widget-toolbar">
        <div className="widget-toolbar-inner">
          <ToolbarContent widgets={widgets} activeIndex={activeIndex} pinned={pinned} />
        </div>
        {timerActive && (
          <div
            key={`toolbar-timer-${cycleId}-${rotationMs}`}
            className="widget-toolbar-fill"
            style={{ animationDuration: `${rotationMs}ms` }}
            aria-hidden="true"
          >
            <div className="widget-toolbar-inner widget-toolbar-inner--on-fill">
              <ToolbarContent widgets={widgets} activeIndex={activeIndex} pinned={pinned} />
            </div>
          </div>
        )}
      </div>
      <div className="widget-display">
        <Component key={key} />
      </div>
    </div>
  );
}

export default Widgets;
