import { useLayoutEffect, useRef } from 'react';
import {
  prefersReducedMotion,
  runRevealTimeline,
  showRevealFinalState,
} from '../lib/widget-load-anime';

/**
 * Skeleton while `loading && !ready`; one anime reveal per load cycle when ready.
 * Poll refreshes that keep `ready` true do not re-play.
 *
 * @param {{ loading: boolean, ready: boolean, rootRef: React.RefObject<HTMLElement | null> }} opts
 * @returns {{ showSkeleton: boolean }}
 */
export function useWidgetLoadSequence({ loading, ready, rootRef }) {
  const playedRef = useRef(false);
  const animRef = useRef(null);

  useLayoutEffect(() => {
    if (!ready) {
      playedRef.current = false;
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
      return undefined;
    }

    if (playedRef.current) return undefined;

    const rootEl = rootRef?.current;
    if (!rootEl) return undefined;

    playedRef.current = true;
    rootEl.setAttribute('data-load-pending', '');

    if (prefersReducedMotion()) {
      showRevealFinalState(rootEl);
      return undefined;
    }

    animRef.current = runRevealTimeline(rootEl);

    return () => {
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }
    };
  }, [ready, rootRef]);

  return {
    showSkeleton: Boolean(loading && !ready),
  };
}

export default useWidgetLoadSequence;
