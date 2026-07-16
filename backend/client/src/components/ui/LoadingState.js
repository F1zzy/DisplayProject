import React from 'react';
import './AsyncStates.css';

function LoadingState({ children = 'Loading…', className = '' }) {
  return (
    <p className={`async-state async-state--loading widget-loading ${className}`.trim()}>
      {children}
    </p>
  );
}

export default LoadingState;
