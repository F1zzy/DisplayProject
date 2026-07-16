import React from 'react';
import './AsyncStates.css';

function EmptyState({ children = 'Nothing to show', className = '' }) {
  return (
    <p className={`async-state async-state--empty ${className}`.trim()}>
      {children}
    </p>
  );
}

export default EmptyState;
