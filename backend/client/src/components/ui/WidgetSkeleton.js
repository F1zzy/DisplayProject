import React, { useEffect, useRef } from 'react';
import { runSkeletonPulse } from '../../lib/widget-load-anime';
import './WidgetSkeleton.css';

/**
 * Panel-shaped loading placeholder with a soft anime opacity pulse.
 */
function WidgetSkeleton({ label = 'Loading…', rows = 4, className = '' }) {
  const rootRef = useRef(null);
  const rowCount = Math.max(1, Math.min(8, Number(rows) || 4));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const pulse = runSkeletonPulse(root);
    return () => pulse.cancel();
  }, [rowCount]);

  return (
    <div
      ref={rootRef}
      className={`widget-skeleton ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="widget-skeleton-title" data-skeleton-bar />
      <div className="widget-skeleton-rows">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            className={`widget-skeleton-row widget-skeleton-row--${(index % 3) + 1}`}
            data-skeleton-bar
          />
        ))}
      </div>
      <span className="widget-skeleton-label">{label}</span>
    </div>
  );
}

export default WidgetSkeleton;
