import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeTransition } from '../../lib/dashboard-motion';
import './AsyncStates.css';

function LoadingState({ children = 'Loading…', className = '' }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.p
      className={`async-state async-state--loading widget-loading ${className}`.trim()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fadeTransition(reduceMotion, 0.3)}
    >
      {children}
    </motion.p>
  );
}

export default LoadingState;
