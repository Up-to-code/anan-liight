import type { RuntimeContainer } from "@modules/internal/runtime";

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    store: "ok" | "failed";
    queue: "ok" | "saturated";
  };
}

/**
 * Returns lightweight liveness status.
 * @returns Alive marker
 */
export function getLiveness(): { status: "ok" } {
  return { status: "ok" };
}

/**
 * Performs readiness checks for dependencies.
 * @param runtime Runtime container
 * @returns Readiness status
 */
export async function getReadiness(runtime: RuntimeContainer): Promise<ReadinessStatus> {
  const queueHealthy = runtime.runner.queueDepth() < runtime.env.QUEUE_MAX_SIZE;
  const storeHealthy = runtime.env.SPACETIMEDB_HTTP_URL.length > 0;

  return {
    ready: queueHealthy && storeHealthy,
    checks: {
      store: storeHealthy ? "ok" : "failed",
      queue: queueHealthy ? "ok" : "saturated"
    }
  };
}
