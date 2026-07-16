import React from 'react';
import './AsyncStates.css';

function ErrorState({ children = 'Unable to load', className = '' }) {
  return (
    <p className={`async-state async-state--error ${className}`.trim()} role="alert">
      {children}
    </p>
  );
}

export default ErrorState;
