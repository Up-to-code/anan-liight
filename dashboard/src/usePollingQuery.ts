import { useCallback, useEffect, useRef, useState } from "react";

interface PollingState<T> {
  data: T | null;
  loading: boolean;
  stale: boolean;
  error: string;
  refresh: () => Promise<void>;
}

interface PollingOptions {
  activeMs?: number;
  hiddenMs?: number;
  enabled?: boolean;
}

export function usePollingQuery<T>(fetcher: () => Promise<T>, options: PollingOptions = {}): PollingState<T> {
  const activeMs = options.activeMs ?? 8000;
  const hiddenMs = options.hiddenMs ?? 20000;
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<number | null>(null);
  const failureCountRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      if (!data) setLoading(true);
      const next = await fetcher();
      setData(next);
      setError("");
      setStale(false);
      failureCountRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setStale(true);
      failureCountRef.current += 1;
    } finally {
      setLoading(false);
    }
  }, [fetcher, data]);

  useEffect(() => {
    let canceled = false;
    if (!enabled) return;

    const tick = async () => {
      if (canceled) return;
      await refresh();
      const baseDelay = document.hidden ? hiddenMs : activeMs;
      const exp = Math.min(failureCountRef.current, 4);
      const jitter = Math.floor(Math.random() * 500);
      let delay = baseDelay * (2 ** exp) + jitter;
      if (error.includes("Too Many Requests")) {
        delay = Math.max(delay, 30000);
      }
      if (error.length > 0 && looksServerError(error)) {
        delay = Math.max(delay, 15000);
      }
      timerRef.current = window.setTimeout(tick, delay);
    };

    void tick();

    return () => {
      canceled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [refresh, activeMs, hiddenMs, enabled, error]);

  return { data, loading, stale, error, refresh };
}

function looksServerError(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("too many requests") || text.includes("500") || text.includes("503");
}
