/** Shared Motion presets for the kiosk dashboard (opacity / y only — Pi-friendly). */

export const DASH_EASE = [0.22, 1, 0.36, 1];

export function listContainerVariants(reduceMotion, stagger = 0.05) {
  return {
    hidden: {},
    show: {
      transition: reduceMotion
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: stagger, delayChildren: 0.04 },
    },
  };
}

export function listItemVariants(reduceMotion, y = 14) {
  if (reduceMotion) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.15 } },
    };
  }
  return {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: DASH_EASE },
    },
  };
}

export function fadeTransition(reduceMotion, duration = 0.45) {
  return reduceMotion
    ? { duration: 0.15, ease: 'easeOut' }
    : { duration, ease: DASH_EASE };
}

export function nightDimAnimate(active, reduceMotion) {
  return {
    opacity: active ? 0.28 : 1,
    transition: fadeTransition(reduceMotion, 0.9),
  };
}
