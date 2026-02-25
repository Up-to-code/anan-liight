export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  deadlineMs: number;
  jitter: "full" | "none";
}

/**
 * Calculates the delay for next retry attempt.
 * @param attempt Attempt number starting at 1
 * @param policy Retry policy
 * @returns Delay in milliseconds
 */
export function computeRetryDelay(attempt: number, policy: RetryPolicy): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  if (policy.jitter === "none") return exponential;
  return Math.floor(Math.random() * (exponential + 1));
}
