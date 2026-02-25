import { useCallback, useEffect, useRef, useState } from "react";

interface PollingState<T> {
  data: T | null;
  loading: boolean;
  stale: boolean;
  error: string;
  refresh: () => Promise<void>;
}

export function usePollingQuery<T>(fetcher: () => Promise<T>, activeMs = 5000, hiddenMs = 10000): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!data) setLoading(true);
      const next = await fetcher();
      setData(next);
      setError("");
      setStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, [fetcher, data]);

  useEffect(() => {
    let canceled = false;

    const tick = async () => {
      if (canceled) return;
      await refresh();
      const delay = document.hidden ? hiddenMs : activeMs;
      timerRef.current = window.setTimeout(tick, delay);
    };

    void tick();

    return () => {
      canceled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [refresh, activeMs, hiddenMs]);

  return { data, loading, stale, error, refresh };
}
