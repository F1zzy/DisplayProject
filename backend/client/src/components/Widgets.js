import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import './Widgets.css';
import ErrorBoundary from './ErrorBoundary';
import LoadingState from './ui/LoadingState';
import { useSettings } from '../context/SettingsContext';
import { reportWidgetView } from '../api/client';

const WIDGET_EASE = [0.22, 1, 0.36, 1];

function widgetStageVariants(reduceMotion) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return {
    initial: (direction) => ({
      opacity: 0,
      y: direction >= 0 ? 28 : -28,
      scale: 0.985,
    }),
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: (direction) => ({
      opacity: 0,
      y: direction >= 0 ? -22 : 22,
      scale: 0.99,
    }),
  };
}

function widgetStageTransition(reduceMotion) {
  if (reduceMotion) {
    return { duration: 0.12, ease: 'easeOut' };
  }
  return { duration: 0.48, ease: WIDGET_EASE };
}

function rotationDirection(fromIndex, toIndex, length) {
  if (length <= 1 || fromIndex === toIndex) return 1;
  const forward = (toIndex - fromIndex + length) % length;
  const backward = (fromIndex - toIndex + length) % length;
  return forward <= backward ? 1 : -1;
}

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
  globe: {
    key: 'globe',
    label: 'World',
    Component: lazy(() => import('./WidgetComponents/WorldGlobe')),
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
  const reduceMotion = useReducedMotion();
  const widgets = useMemo(() => {
    const enabled = Array.isArray(settings.enabledWidgets) ? settings.enabledWidgets : [];
    const list = enabled.map((key) => WIDGET_REGISTRY[key]).filter(Boolean);
    return list.length > 0 ? list : Object.values(WIDGET_REGISTRY);
  }, [settings.enabledWidgets]);

  const rotationMs = settings.widgetRotationMs ?? 120000;
  const [currentWidget, setCurrentWidget] = useState(0);
  const [cycleId, setCycleId] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerActive = rotationMs > 0 && widgets.length > 1 && !pinned;
  const indexRef = useRef(0);

  useEffect(() => {
    setCurrentWidget((prev) => (prev >= widgets.length ? 0 : prev));
  }, [widgets.length]);

  useEffect(() => {
    if (forcedWidget !== null && forcedWidget !== undefined) {
      const next = forcedWidget % widgets.length;
      setDirection(rotationDirection(indexRef.current, next, widgets.length));
      setCurrentWidget(next);
      indexRef.current = next;
      setCycleId((id) => id + 1);
      onWidgetShown?.();
    }
  }, [forcedWidget, onWidgetShown, widgets.length]);

  useEffect(() => {
    if (!timerActive) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setDirection(1);
      setCurrentWidget((prevWidget) => {
        const next = (prevWidget + 1) % widgets.length;
        indexRef.current = next;
        return next;
      });
      setCycleId((id) => id + 1);
    }, rotationMs);

    return () => clearTimeout(timeout);
  }, [rotationMs, widgets.length, timerActive, cycleId]);

  const activeIndex = currentWidget % widgets.length;
  const { Component, key, label } = widgets[activeIndex];
  const lastBeaconKey = useRef(null);
  const stageVariants = widgetStageVariants(reduceMotion);
  const stageTransition = widgetStageTransition(reduceMotion);

  useEffect(() => {
    if (!key) return;
    // Remote-driven jumps are counted by the Node display routes; only beacon local/auto views.
    if (forcedWidget !== null && forcedWidget !== undefined) {
      lastBeaconKey.current = key;
      return;
    }
    if (lastBeaconKey.current === key) return;
    lastBeaconKey.current = key;
    reportWidgetView(key, 'auto');
  }, [key, forcedWidget]);

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
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={key}
            className="widget-stage"
            custom={direction}
            variants={stageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={stageTransition}
          >
            <ErrorBoundary
              label={`widget:${key}`}
              title={`${label} unavailable`}
              message="This widget failed. Rotation and other widgets keep working."
            >
              <Suspense fallback={<LoadingState>Loading widget…</LoadingState>}>
                <Component />
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Widgets;
