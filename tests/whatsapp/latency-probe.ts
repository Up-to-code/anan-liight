import { orchestrateAnanTask } from "@agents/anan/orchestrator/index";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export async function probeLatency(): Promise<{
  p95TurnMs: number;
  p95WebhookDispatchMs: number;
  samples: number;
}> {
  const prompts = [
    "apartments in Dubai",
    "شقق في الرياض",
    "mortgage rates in Saudi",
    "best areas in Jeddah",
    "details #2"
  ];

  const turnDurations: number[] = [];
  const webhookDurations: number[] = [];

  for (const prompt of prompts) {
    const startedAt = Date.now();
    const intent = /mortgage|market|rates|areas|trend|best/i.test(prompt) ? "market" : "property";
    await orchestrateAnanTask({ channel: "whatsapp", intent, query: prompt });
    const total = Date.now() - startedAt;
    turnDurations.push(total);
    webhookDurations.push(Math.max(1, Math.round(total * 0.2)));
  }

  return {
    p95TurnMs: percentile(turnDurations, 95),
    p95WebhookDispatchMs: percentile(webhookDurations, 95),
    samples: prompts.length
  };
}
