import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import './Widgets.css';
import ErrorBoundary from './ErrorBoundary';
import LoadingState from './ui/LoadingState';
import { useSettings } from '../context/SettingsContext';

const WIDGET_REGISTRY = {
  stock: {
    key: 'stock',
    label: 'Stocks',
    Component: lazy(() => import('./WidgetComponents/StockMarket')),
  },
  news: {
    key: 'news',
    label: 'News',
    Component: lazy(() => import('./WidgetComponents/News')),
  },
  timetable: {
    key: 'timetable',
    label: 'Schedule',
    Component: lazy(() => import('./WidgetComponents/TimeTable')),
  },
  network: {
    key: 'network',
    label: 'Network',
    Component: lazy(() => import('./WidgetComponents/NetworkStats')),
  },
  sky: {
    key: 'sky',
    label: 'Night Sky',
    Component: lazy(() => import('./WidgetComponents/NightSky')),
  },
  spotify: {
    key: 'spotify',
    label: 'Spotify',
    Component: lazy(() => import('./WidgetComponents/SpotifyNow')),
  },
  f1: {
    key: 'f1',
    label: 'Formula 1',
    Component: lazy(() => import('./WidgetComponents/F1Standings')),
  },
};

function ToolbarContent({ widgets, activeIndex, pinned }) {
  return (
    <>
      <h2 className="widget-toolbar-title">
        Widgets{pinned ? <span className="widget-pinned-badge">Pinned</span> : null}
      </h2>
      <div className="widget-tabs" role="tablist" aria-label="Active widget" aria-hidden="true">
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
    const list = enabled.map((key) => WIDGET_REGISTRY[key]).filter(Boolean);
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
  const { Component, key, label } = widgets[activeIndex];

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
      <div
        className="widget-display"
        role="region"
        aria-live="polite"
        aria-label={`${label} widget`}
      >
        <ErrorBoundary
          key={key}
          label={`widget:${key}`}
          title={`${label} unavailable`}
          message="This widget failed. Rotation and other widgets keep working."
        >
          <Suspense fallback={<LoadingState>Loading widget…</LoadingState>}>
            <Component key={key} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default Widgets;
