import { useEffect, useRef } from "react";

export function usePolling(task: () => Promise<void> | void, activeMs = 5000, hiddenMs = 10000): void {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let canceled = false;

    const run = async () => {
      if (canceled) return;
      await task();
      const delay = document.hidden ? hiddenMs : activeMs;
      timerRef.current = window.setTimeout(run, delay);
    };

    void run();

    return () => {
      canceled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [task, activeMs, hiddenMs]);
}
