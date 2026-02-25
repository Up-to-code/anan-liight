import type { AgentScheduler } from "@agents/agent-scheduler";

export interface CronRegistration {
  jobName: string;
  intervalMs: number;
  payload: Record<string, string>;
}

export const CRON_REGISTRY: CronRegistration[] = [
  {
    jobName: "archive_expired_agent_threads",
    intervalMs: 60 * 60 * 1000,
    payload: { limit: "100" }
  },
  {
    jobName: "delete_expired_search_cache",
    intervalMs: 15 * 60 * 1000,
    payload: { limit: "500" }
  },
  {
    jobName: "wa_campaign_dispatch_tick",
    intervalMs: 30 * 1000,
    payload: { queue: "wa-campaign-dispatch" }
  },
  {
    jobName: "workflow_step_replay_tick",
    intervalMs: 30 * 1000,
    payload: { queue: "workflow-step-replay" }
  }
];

/**
 * Schedules baseline recurring jobs into durable scheduler table.
 * @param scheduler Agent scheduler
 */
export async function seedCronJobs(scheduler: AgentScheduler): Promise<void> {
  const now = Date.now();
  for (const item of CRON_REGISTRY) {
    await scheduler.schedule(item.jobName, item.payload, now + item.intervalMs);
  }
}
