import { renderHook, waitFor, act } from '@testing-library/react';
import { usePollingFetch } from './usePollingFetch';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  console.error.mockRestore();
});

test('loads data on mount', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true });
  const { result } = renderHook(() => usePollingFetch(fetcher, { intervalMs: 0 }));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual({ ok: true });
  expect(result.current.error).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('polls on an interval', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce({ n: 1 })
    .mockResolvedValueOnce({ n: 2 });

  const { result } = renderHook(() =>
    usePollingFetch(fetcher, { intervalMs: 1000 })
  );

  await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

  await act(async () => {
    jest.advanceTimersByTime(1000);
  });

  await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('does not update state after unmount', async () => {
  let resolveFetch;
  const fetcher = jest.fn(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
  );

  const { unmount } = renderHook(() => usePollingFetch(fetcher, { intervalMs: 0 }));
  unmount();

  await act(async () => {
    resolveFetch({ late: true });
  });

  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('sets error message when fetch fails', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('network down'));
  const { result } = renderHook(() => usePollingFetch(fetcher, { intervalMs: 0 }));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('network down');
  expect(result.current.data).toBeNull();
});
