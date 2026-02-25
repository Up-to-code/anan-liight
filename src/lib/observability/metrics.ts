export interface CounterMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
}

export interface DurationMetric {
  name: string;
  ms: number;
  tags: Record<string, string>;
}

const counters = new Map<string, number>();
const durations: DurationMetric[] = [];

/**
 * Increments an in-process counter for development observability.
 * @param name Metric name
 * @param tags Metric tags
 */
export function incrementCounter(name: string, tags: Record<string, string>): void {
  const key = `${name}:${JSON.stringify(tags)}`;
  const current = counters.get(key) ?? 0;
  counters.set(key, current + 1);
}

/**
 * Reads current counter snapshots.
 * @returns List of counters
 */
export function readCounters(): CounterMetric[] {
  return Array.from(counters.entries()).map(([key, value]) => {
    const [name, rawTags] = key.split(":", 2);
    const safeName = name ?? "unknown_metric";
    const safeTags = rawTags ? (JSON.parse(rawTags) as Record<string, string>) : {};
    return { name: safeName, value, tags: safeTags };
  });
}

/**
 * Records operation duration sample.
 * @param name Metric name
 * @param ms Duration in milliseconds
 * @param tags Metric tags
 */
export function observeDuration(name: string, ms: number, tags: Record<string, string>): void {
  durations.push({ name, ms, tags });
}

/**
 * Reads recorded duration samples.
 * @returns Duration metrics
 */
export function readDurations(): DurationMetric[] {
  return [...durations];
}
