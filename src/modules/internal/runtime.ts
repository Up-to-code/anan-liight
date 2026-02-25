import { randomUUID } from "node:crypto";
import { AgentRunner } from "@agents/agent-runner";
import { AgentScheduler } from "@agents/agent-scheduler";
import { AgentMessageBus } from "@agents/agent-message-bus";
import { ModelFallbackChain } from "@lib/openrouter/model-fallback-chain";
import { OpenRouterClient } from "@lib/openrouter/openrouter-client";
import { createDefaultModelAttempts, executeOpenRouterWithFallback } from "@lib/openrouter/openrouter-retry";
import { loadEnv, type AppEnv } from "@lib/config/env";
import { withLogContext } from "@lib/observability/logger";
import { MessageBusAdapter, SchedulerAdapter, WorkflowPersistenceAdapter } from "@modules/internal/ports";
import { seedCronJobs } from "@modules/internal/cron-registry";
import { SpacetimeHttpStore, type SpacetimeStore } from "@modules/internal/spacetime-store";
import { StepRunner } from "@workflows/step-runner";
import { StepReplayRegistry } from "@workflows/step-replay-registry";
import { StepReplayWorker } from "@workflows/step-replay-worker";
import { WorkflowEngine } from "@workflows/workflow-engine";
import { SessionStore } from "@lib/auth/session-store";
import { StoreDeadLetterWriter } from "@lib/retry/store-dead-letter";
import { runCampaignSchedulerTick } from "@modules/whatsapp/scheduler/service";
import type { CircuitStatePort } from "@lib/openrouter/circuit-state";
import { TABLE_NAMES } from "@shared/constants";
import { buildInstructionEnvelope } from "@agents/anan/runtime/instruction-builder";
import { ensureRequiredTables, type TableProvisioningReport } from "@modules/internal/table-provisioning";

export interface RuntimeContainer {
  env: AppEnv;
  store: SpacetimeStore;
  runner: AgentRunner;
  scheduler: AgentScheduler;
  messageBus: AgentMessageBus;
  workflowEngine: WorkflowEngine;
  sessionStore: SessionStore;
  replayWorker: StepReplayWorker;
  getTableProvisioningReport(): TableProvisioningReport;
  getBuildVersion(): string;
  generateAssistantText(prompt: string): Promise<string>;
}

/**
 * Creates app runtime container with all core services.
 * @returns Runtime container
 */
export function createRuntime(): RuntimeContainer {
  const env = loadEnv();
  const store = new SpacetimeHttpStore(env);
  const buildVersion = process.env["VERCEL_GIT_COMMIT_SHA"] ?? process.env["GIT_COMMIT_SHA"] ?? "local";
  let tableProvisioningReport: TableProvisioningReport = {
    state: env.NODE_ENV === "test" ? "skipped" : "pending",
    checkedAt: Date.now(),
    created: [],
    existing: [],
    failed: []
  };

  if (env.NODE_ENV !== "test") {
    void ensureRequiredTables(env)
      .then((report) => {
        tableProvisioningReport = report;
      })
      .catch((error) => {
        tableProvisioningReport = {
          state: "degraded",
          checkedAt: Date.now(),
          created: [],
          existing: [],
          failed: [{ table: "startup", error: error instanceof Error ? error.message : "unknown error" }]
        };
      });
  }

  const backgroundJobsEnabled = env.FEATURE_LLIGHT_BACKGROUND_JOBS_ENABLED && env.NODE_ENV !== "test";

  const messageBus = new AgentMessageBus(new MessageBusAdapter(store));
  const scheduler = new AgentScheduler(new SchedulerAdapter(store));
  if (backgroundJobsEnabled) {
    void seedCronJobs(scheduler).catch((error) => {
      withLogContext({ traceId: randomUUID() }).error({
        event: "seed_cron_jobs_failed",
        message: error instanceof Error ? error.message : "unknown error"
      });
    });
  }

  const runner = new AgentRunner("agent-default", env.QUEUE_MAX_SIZE, env.WORKER_POOL_CONCURRENCY);
  void runner.start();

  const replayRegistry = new StepReplayRegistry();
  const deadLetterWriter = new StoreDeadLetterWriter(store);
  const stepRunner = new StepRunner(new WorkflowPersistenceAdapter(store), {
    immediateRetries: 3,
    scheduledRetries: 5,
    scheduler,
    replayQueueName: "workflow-step-replay",
    replayRegistry,
    deadLetter: deadLetterWriter
  });
  const workflowEngine = new WorkflowEngine(stepRunner, new WorkflowPersistenceAdapter(store));
  const replayWorker = new StepReplayWorker({
    scheduler,
    registry: replayRegistry,
    deadLetter: deadLetterWriter,
    queueName: "workflow-step-replay",
    maxScheduledRounds: 5
  });
  if (backgroundJobsEnabled) {
    replayWorker.start();
  }

  const openRouterClient = new OpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL
  });

  const parseModelChain = (): string[] => {
    const chain = env.OPENROUTER_MODEL_CHAIN
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const fallback = [env.OPENROUTER_PRIMARY_MODEL, env.OPENROUTER_FALLBACK_MODEL, env.OPENROUTER_F1_MODEL];
    const candidate = chain.length > 0 ? chain : fallback;
    const allowlist = env.OPENROUTER_MODEL_ALLOWLIST
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (allowlist.length === 0) return candidate;
    const filtered = candidate.filter((model) => allowlist.includes(model));
    return filtered.length > 0 ? filtered : fallback;
  };

  const circuitStatePort: CircuitStatePort = {
    load: async () => {
      const rows = await store.queryMany<{ circuit: string; failures: number; openedAt?: number }>(
        TABLE_NAMES.CIRCUIT_BREAKER_STATE,
        [],
        200
      );
      return rows.map((row) => ({
        model: row.circuit,
        failures: row.failures,
        ...(row.openedAt != null ? { openedAt: row.openedAt } : {})
      }));
    },
    save: async (model, state) => {
      const existing = await store.queryOne<{ id: string; version: number }>(TABLE_NAMES.CIRCUIT_BREAKER_STATE, [
        { field: "circuit", op: "eq", value: model }
      ]);
      if (existing) {
        const patch: { failures: number; status: string; version: number; updatedAt: number; openedAt?: number } = {
          failures: state.failures,
          status: state.openedAt ? "OPEN" : "CLOSED",
          version: existing.version + 1,
          updatedAt: Date.now()
        };
        if (state.openedAt != null) patch.openedAt = state.openedAt;
        await store.updateVersioned(TABLE_NAMES.CIRCUIT_BREAKER_STATE, existing.id, existing.version, patch);
        return;
      }
      await store.insert(TABLE_NAMES.CIRCUIT_BREAKER_STATE, {
        id: randomUUID(),
        circuit: model,
        failures: state.failures,
        openedAt: state.openedAt,
        status: state.openedAt ? "OPEN" : "CLOSED",
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  };

  const fallbackChain = new ModelFallbackChain(
    createDefaultModelAttempts({
      models: parseModelChain(),
      timeoutMs: env.OPENROUTER_TIMEOUT_MS,
      maxTokens: env.OPENROUTER_MAX_TOKENS,
      temperature: env.OPENROUTER_TEMPERATURE
    }),
    env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    env.CIRCUIT_BREAKER_COOLDOWN_MS,
    circuitStatePort
  );

  const runtimeRef: RuntimeContainer = {
    env,
    store,
    runner,
    scheduler,
    messageBus,
    workflowEngine,
    sessionStore: new SessionStore(store, env.SESSION_ENCRYPTION_KEY),
    replayWorker,
    getTableProvisioningReport: () => tableProvisioningReport,
    getBuildVersion: () => buildVersion,
    async generateAssistantText(prompt: string): Promise<string> {
      const traceId = randomUUID();
      const instruction = buildInstructionEnvelope({ channel: "web" });
      const result = await executeOpenRouterWithFallback(
        openRouterClient,
        [
          { role: "system", content: instruction },
          { role: "user", content: prompt }
        ],
        {
          chain: fallbackChain,
          retryPolicy: {
            maxAttempts: 3,
            baseDelayMs: 120,
            maxDelayMs: 2000,
            deadlineMs: 6000,
            jitter: "full"
          }
        }
      );

      withLogContext({ traceId }).info({
        event: "assistant_response_generated",
        model: result.model,
        tokens: result.response.usage?.total_tokens ?? 0
      });

      const content = result.response.choices[0]?.message.content;
      return content && content.length > 0 ? content : "";
    }
  };
  if (backgroundJobsEnabled) {
    setInterval(() => {
      void runCampaignSchedulerTick(runtimeRef).catch((error) => {
        withLogContext({ traceId: randomUUID() }).warn({
          event: "wa_campaign_scheduler_tick_failed",
          message: error instanceof Error ? error.message : "unknown error"
        });
      });
    }, 5000);
  }

  return runtimeRef;
}
