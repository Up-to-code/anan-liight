# WhatsApp Platform v1.3 (ANAN-LIIGHT)

## Scope
This module provides an independent WhatsApp service layer with:
1. Template lifecycle.
2. Campaign scheduling/execution.
3. 24-hour policy enforcement.
4. Adaptive throttled batch send (up to 100).
5. Delivery/feedback/performance telemetry.

## Core Modules
- `src/modules/whatsapp/templates`
- `src/modules/whatsapp/campaigns`
- `src/modules/whatsapp/conversations`
- `src/modules/whatsapp/delivery`
- `src/modules/whatsapp/feedback`
- `src/modules/whatsapp/metrics`
- `src/modules/whatsapp/compliance`
- `src/modules/whatsapp/scheduler`

## Policy Defaults
1. If 24h window is closed, free-form campaign sends are blocked.
2. Template sends are allowed outside the window.
3. Campaign dispatcher uses adaptive throttle and logs backpressure.

## APIs
- `POST /api/whatsapp/templates`
- `POST /api/whatsapp/templates/:templateId/submit`
- `POST /api/whatsapp/templates/:templateId/sync`
- `GET /api/whatsapp/templates`
- `POST /api/whatsapp/campaigns`
- `POST /api/whatsapp/campaigns/run`
- `POST /api/whatsapp/feedback`
- `GET /api/whatsapp/performance`

## Tables
- `wa_templates`
- `wa_template_versions`
- `wa_campaigns`
- `wa_campaign_recipients`
- `wa_send_jobs`
- `wa_send_attempts`
- `wa_conversation_windows`
- `wa_feedback_events`
- `wa_number_performance_snapshots`
- `wa_policy_audit_log`

## Reliability
1. Workflow steps use 3 immediate retries + 5 scheduled replay rounds.
2. Replay worker drains `workflow-step-replay` queue and writes terminal failures to DLQ.
3. Model failover chain supports cooldown with persisted circuit state.
