import type { RuntimeContainer } from "@modules/internal/runtime";

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    store: "ok" | "failed";
    queue: "ok" | "saturated";
    tableProvisioning: "ok" | "degraded" | "pending" | "skipped";
  };
  details?: {
    tableProvisioningFailed?: Array<{ table: string; error: string }>;
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
  const provisioning = runtime.getTableProvisioningReport();
  const provisioningReady = provisioning.state === "ok" || provisioning.state === "skipped";

  return {
    ready: queueHealthy && storeHealthy && provisioningReady,
    checks: {
      store: storeHealthy ? "ok" : "failed",
      queue: queueHealthy ? "ok" : "saturated",
      tableProvisioning: provisioning.state
    },
    ...(provisioning.failed.length > 0
      ? {
          details: {
            tableProvisioningFailed: provisioning.failed
          }
        }
      : {})
  };
}
