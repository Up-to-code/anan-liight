import { schema, table, t } from "spacetimedb/server";

const genericRow = {
  id: t.string(),
  payloadJson: t.string(),
  version: t.string(),
  createdAt: t.string(),
  updatedAt: t.string()
};

const spacetimedb = schema({
    agent_souls: table(
      { public: false },
      genericRow
    ),
    session_tokens: table(
      { public: false },
      genericRow
    ),
    chat_messages: table(
      { public: false },
      genericRow
    ),
    workflow_runs: table(
      { public: false },
      genericRow
    ),
    workflow_steps: table(
      { public: false },
      genericRow
    ),
    scheduler_jobs: table(
      { public: false },
      genericRow
    ),
    agent_messages: table(
      { public: false },
      genericRow
    ),
    dead_letters: table(
      { public: false },
      genericRow
    ),
    idempotency_journal: table(
      { public: false },
      genericRow
    ),
    outbox_events: table(
      { public: false },
      genericRow
    ),
    thread_metadata: table(
      { public: false },
      genericRow
    ),
    user_profiles: table(
      { public: false },
      genericRow
    ),
    partners: table(
      { public: false },
      genericRow
    ),
    properties: table(
      { public: false },
      genericRow
    ),
    notifications: table(
      { public: false },
      genericRow
    ),
    agent_traces: table(
      { public: false },
      genericRow
    ),
    whatsapp_inbound_events: table(
      { public: false },
      genericRow
    ),
    whatsapp_delivery_logs: table(
      { public: false },
      genericRow
    ),
    whatsapp_voice_confirmations: table(
      { public: false },
      genericRow
    ),
    wa_templates: table(
      { public: false },
      genericRow
    ),
    wa_template_versions: table(
      { public: false },
      genericRow
    ),
    wa_campaigns: table(
      { public: false },
      genericRow
    ),
    wa_campaign_recipients: table(
      { public: false },
      genericRow
    ),
    wa_send_jobs: table(
      { public: false },
      genericRow
    ),
    wa_send_attempts: table(
      { public: false },
      genericRow
    ),
    wa_conversation_windows: table(
      { public: false },
      genericRow
    ),
    wa_feedback_events: table(
      { public: false },
      genericRow
    ),
    wa_number_performance_snapshots: table(
      { public: false },
      genericRow
    ),
    wa_policy_audit_log: table(
      { public: false },
      genericRow
    ),
    agent_lifecycle_events: table(
      { public: false },
      genericRow
    ),
    workflow_step_events: table(
      { public: false },
      genericRow
    ),
    circuit_breaker_state: table(
      { public: false },
      genericRow
    ),
    feature_flags: table(
      { public: false },
      genericRow
    ),
});

export default spacetimedb;

export const init = spacetimedb.init(() => {
  // Module bootstrap lifecycle hook.
});

export const onConnect = spacetimedb.clientConnected(() => {
  // Connection lifecycle hook.
});

export const onDisconnect = spacetimedb.clientDisconnected(() => {
  // Disconnection lifecycle hook.
});
