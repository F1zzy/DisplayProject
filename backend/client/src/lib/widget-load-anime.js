import { animate, createTimeline, stagger } from 'animejs';

/** Soft ease; opacity + small y only (Pi-friendly, no blur/filter). */
export const WIDGET_LOAD_EASE = 'outQuad';

const REVEAL_Y = 12;
const TITLE_DURATION = 380;
const ITEM_DURATION = 320;
const ITEM_STAGGER = 55;

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cancelAnim(instance) {
  if (!instance) return;
  try {
    if (typeof instance.pause === 'function') instance.pause();
    if (typeof instance.cancel === 'function') instance.cancel();
    else if (typeof instance.revert === 'function') instance.revert();
  } catch {
    // Animation may already be torn down with the DOM node.
  }
}

/**
 * Soft opacity pulse for skeleton bars while a widget is fetching.
 * @returns {{ cancel: () => void }}
 */
export function runSkeletonPulse(rootEl) {
  if (!rootEl || prefersReducedMotion()) {
    return { cancel() {} };
  }

  const bars = rootEl.querySelectorAll('[data-skeleton-bar]');
  if (!bars.length) {
    return { cancel() {} };
  }

  const animation = animate(bars, {
    opacity: [0.35, 0.82],
    duration: 900,
    ease: 'inOutSine',
    alternate: true,
    loop: true,
    delay: stagger(70),
  });

  return {
    cancel() {
      cancelAnim(animation);
    },
  };
}

/**
 * Show final revealed state without animating (reduced motion / fallback).
 */
export function showRevealFinalState(rootEl) {
  if (!rootEl) return;
  const steps = rootEl.querySelectorAll('[data-load-step]');
  steps.forEach((el) => {
    el.style.opacity = '1';
    el.style.translate = 'none';
    el.style.transform = '';
  });
  rootEl.removeAttribute('data-load-pending');
}

/**
 * Staged reveal: titles first, then staggered items.
 * @returns {{ cancel: () => void }}
 */
export function runRevealTimeline(rootEl) {
  if (!rootEl) {
    return { cancel() {} };
  }

  if (prefersReducedMotion()) {
    showRevealFinalState(rootEl);
    return { cancel() {} };
  }

  const titles = rootEl.querySelectorAll('[data-load-step="title"]');
  const items = rootEl.querySelectorAll('[data-load-step="item"]');

  if (!titles.length && !items.length) {
    rootEl.removeAttribute('data-load-pending');
    return { cancel() {} };
  }

  rootEl.setAttribute('data-load-pending', '');

  const timeline = createTimeline({
    defaults: {
      ease: WIDGET_LOAD_EASE,
    },
    onComplete: () => {
      rootEl.removeAttribute('data-load-pending');
    },
  });

  if (titles.length) {
    timeline.add(titles, {
      opacity: [0, 1],
      y: [REVEAL_Y, 0],
      duration: TITLE_DURATION,
    });
  }

  if (items.length) {
    timeline.add(
      items,
      {
        opacity: [0, 1],
        y: [REVEAL_Y - 2, 0],
        duration: ITEM_DURATION,
        delay: stagger(ITEM_STAGGER),
      },
      titles.length ? '-=160' : 0
    );
  }

  return {
    cancel() {
      cancelAnim(timeline);
      showRevealFinalState(rootEl);
    },
  };
}
