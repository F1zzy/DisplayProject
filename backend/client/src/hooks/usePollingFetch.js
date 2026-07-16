import { useEffect, useRef, useState } from 'react';

/**
 * Fetch data once, optionally on an interval, with cancel-on-unmount.
 * @param {() => Promise<any>} fetcher
 * @param {{ intervalMs?: number, enabled?: boolean, deps?: any[] }} [options]
 */
export function usePollingFetch(fetcher, options = {}) {
  const { intervalMs = 0, enabled = true, deps = [] } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await fetcherRef.current();
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err?.message || 'Request failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();

    if (!(intervalMs > 0)) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps provided by caller
  }, [enabled, intervalMs, ...deps]);

  return { data, loading, error };
}
