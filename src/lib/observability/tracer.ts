import { randomUUID } from "node:crypto";

/**
 * Returns existing trace id header or generates a new one.
 * @param existingTraceId Optional incoming trace id
 * @returns Stable trace id string
 */
export function resolveTraceId(existingTraceId: string | undefined): string {
  if (existingTraceId && existingTraceId.length > 0) return existingTraceId;
  return randomUUID();
}
