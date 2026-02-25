# SpacetimeDB Backlog v1 for ANAN-LIIGHT

## Objective
Execute a docs-grounded transition from generic SQL-adapter persistence to SpacetimeDB-native typed reducers/views/subscriptions while preserving external API compatibility.

- Project: `/Users/ahmedmansour/anan/anan-liight`
- External HTTP routes must remain stable during these waves.
- Convex behavior remains reference baseline until each parity item is marked verified.

## Backlog Governance

### Priority Lanes
- `P0`: correctness and platform-fit blockers.
- `P1`: performance and stability hardening.
- `P2`: security and auth boundary hardening.
- `P3`: parity closure with Convex behavior.
- `P4`: observability and operations maturity.

### Wave Policy
- Wave A: P0 foundation
- Wave B: P1 + P2
- Wave C: P3 + P4

### Global Done Conditions
1. `npm run lint`, `npm run typecheck`, `npm test` pass.
2. Existing route contract tests remain green.
3. WhatsApp full gate remains green for dev profile.
4. No critical path depends on brittle SQL text parsing.

## P0 (Correctness + Platform Fit)

### P0-1 Replace SQL CLI store path with reducer/query contracts
- Owner: `backend-platform`
- Scope:
  - Replace `src/modules/internal/spacetime-store.ts` CLI SQL path with reducer/query adapter.
  - Keep a test-only in-memory port for unit tests.
- Deliverables:
  - New reducer/query transport module under `src/modules/internal/`.
  - Compatibility adapter preserving `insert/queryOne/queryMany/updateVersioned` interface short-term.
- Acceptance:
  - No production code path calls `spacetime sql` command.
  - Chat send + workflow persistence pass integration tests.

### P0-2 Migrate from generic payload rows to typed table schemas
- Owner: `backend-platform`
- Scope:
  - Replace generated generic schema in `scripts/sync-spacetimedb-module-schema.ts`.
  - Define explicit typed table fields for: threads, chat messages, workflow runs/steps, idempotency, outbox, WhatsApp delivery.
- Deliverables:
  - Typed module schema source and generation strategy (or static module schema).
- Acceptance:
  - Core table module definitions are typed and validated by compile-time generation.
  - No core entity relies on opaque `payloadJson` as sole data representation.

### P0-3 Define canonical reducer set for core writes
- Owner: `backend-platform`
- Scope:
  - Add reducer contracts for:
    - thread/message writes
    - idempotency journal start/complete
    - workflow state transitions
    - WhatsApp inbound + delivery logs
- Deliverables:
  - Reducer DTOs and typed invokers.
  - Integration tests for idempotent replay on duplicate keys.
- Acceptance:
  - All listed domains write through dedicated reducers.
  - Duplicate idempotency key is safely rejected or resolved deterministically.

## P1 (Performance + Stability)

### P1-1 Remove fragile SQL text parsing and warning stripping
- Owner: `backend-platform`
- Scope:
  - Remove parsing helpers from runtime persistence path (`stripWarnings`, `parseSingleColumnRows`).
- Deliverables:
  - Typed result decoding from reducer/query responses.
- Acceptance:
  - No runtime logic depends on SQL CLI stdout parsing.

### P1-2 Introduce generated bindings for typed interactions
- Owner: `backend-platform`
- Scope:
  - Integrate generated module bindings into runtime ports.
  - Use typed DTOs end-to-end for core reducers/views/subscriptions.
- Deliverables:
  - Binding integration layer + compile task in CI.
- Acceptance:
  - Runtime compiles with strict typing and no `any` in DB interaction layer.

### P1-3 Deterministic retry classes and terminal failure sinks
- Owner: `runtime-reliability`
- Scope:
  - Standardize retry classification for reducer/query/workflow operations.
  - Ensure terminal failure writes to DLQ with trace metadata.
- Deliverables:
  - Retry classifier matrix.
  - Dead-letter enrichment fields (`traceId`, `operation`, `idempotencyKey`, `attempts`).
- Acceptance:
  - Retry policy is deterministic and tested for timeout/conflict/unavailable errors.

## P2 (Security + Auth)

### P2-1 Formalize API auth boundary vs DB identity/permission boundary
- Owner: `security-platform`
- Scope:
  - Define canonical identity contract:
    - API authenticates (Cognito/session/token)
    - DB receives mapped tenant/role claims
- Deliverables:
  - Auth boundary spec doc in `/docs/runbooks`.
  - Context propagation tests from route to DB action.
- Acceptance:
  - All write/read paths include tenant/role context.

### P2-2 Align webhook signature and role gates to least privilege
- Owner: `security-platform`
- Scope:
  - Harden WhatsApp webhook verification and duplicate event handling.
  - Ensure admin-only routes have strict role checks with no legacy bypass in production mode.
- Deliverables:
  - Webhook adversarial tests.
  - Role guard regression tests.
- Acceptance:
  - Invalid signatures rejected 100%.
  - Duplicate inbound events do not produce duplicate side effects.

### P2-3 Prod secret policy and rotation cadence
- Owner: `platform-ops`
- Scope:
  - Establish secret rotation schedule and incident rotation process for Spacetime/OpenRouter/WhatsApp/Cognito.
- Deliverables:
  - Runbook: `/docs/runbooks/secret-rotation.md`.
- Acceptance:
  - Rotation procedure is executable and linked in release checklist.

## P3 (Parity Completion with Convex)

### P3-1 Customer/profile/message/order/history parity matrix
- Owner: `parity-program`
- Scope:
  - Expand parity matrix with function-level behavior and evidence references.
- Deliverables:
  - Updated parity matrix file with `not-started/in-progress/verified` states.
- Acceptance:
  - Every parity row has test evidence and owner.

### P3-2 Missing-function closure in waves A/B/C
- Owner: `parity-program`
- Scope:
  - Wave A: chat + memory + thread lifecycle
  - Wave B: search/tools/workflow edge paths
  - Wave C: admin-facing parity operations
- Deliverables:
  - Completion checklist per wave.
- Acceptance:
  - Each wave reaches green contract tests before next wave starts.

### P3-3 Preserve route payload compatibility while internals change
- Owner: `api-platform`
- Scope:
  - Keep unchanged external paths and payload contracts:
    - `/api/chat`
    - `/api/webhook/whatsapp`
    - `/api/partner/properties`
    - `/api/test/*`
    - `/api/whatsapp/*`
- Deliverables:
  - Contract tests for request/response compatibility.
- Acceptance:
  - No breaking diff in existing client contract snapshots.

## P4 (Observability + Ops)

### P4-1 Standardize trace envelope across webhook/agent/workflow/model
- Owner: `observability-platform`
- Scope:
  - Normalize trace fields in all telemetry writers.
- Deliverables:
  - Required fields: `traceId`, `tenantId`, `threadId`, `workflowRunId`, `idempotencyKey`, `model`, `retryRound`.
- Acceptance:
  - Trace completeness >= 99% in validation suite.

### P4-2 Rollout scorecard and SLO gating
- Owner: `platform-ops`
- Scope:
  - Introduce release scorecard tracking:
    - error rate
    - p95/p99 latency
    - duplicate handling
    - fallback rate
- Deliverables:
  - `/docs/runbooks/rollout-scorecard.md`
- Acceptance:
  - Cutover decision uses scorecard gate and documented thresholds.

## WhatsApp Webhook Readiness Execution (Concrete)

### Callback and Verification
1. Callback URL: `https://<PUBLIC_API_HOST>/api/webhook/whatsapp`
2. Verification success: valid token + subscribe mode -> challenge echo with `200`.
3. Verification failure: invalid token -> `403`.

### Test Flow
1. Verify endpoint handshake test.
2. Signed POST acceptance test.
3. Duplicate event idempotency test.
4. Policy-constrained response test (message budget/link policy).

### Acceptance
- All webhook readiness tests pass in dev profile and staging profile.

## Execution Order (Implementation Waves)

### Wave A (P0)
1. Replace SQL store path with reducer/query transport.
2. Typed table schema adoption for core entities.
3. Canonical reducer set for chat/workflow/idempotency/WA events.

### Wave B (P1 + P2)
1. Generated bindings + parse-path removal.
2. Retry classifier + DLQ enrichment.
3. Auth boundary formalization + webhook/role hardening.

### Wave C (P3 + P4)
1. Parity closure by domains and waves.
2. Contract-stable route validation.
3. Full observability envelope and rollout scorecard.

## Backlog Validation Gates

### Knowledge Validation
1. Every mismatch/missing item in architecture map has one owner, one action, one acceptance condition.
2. Every mapped concept references at least one official SpacetimeDB docs link.

### Architecture Regression Gates
1. Route contract tests stay green throughout waves.
2. Lint/typecheck/tests pass after each merged wave.
3. WhatsApp full gate remains pass in dev profile.

### Platform-Fit Gates
1. No critical path depends on SQL text parsing.
2. Core writes run through typed reducer contracts.
3. Publish/upgrade runbook includes explicit upgrade/conflict handling.

## Planned API / Interface / Type Additions (Backward-Compatible)
1. Keep public route paths unchanged during this phase:
   - `/api/chat`
   - `/api/webhook/whatsapp`
   - `/api/partner/properties`
   - `/api/test/*`
   - `/api/whatsapp/*`
2. Add internal typed DTO boundaries for reducer/query contracts:
   - `WebhookInboundEvent`
   - `ConversationWrite`
   - `WorkflowStepTransition`
   - `DeliveryAttempt`
3. Add transport-level interfaces for typed Spacetime interactions:
   - `ReducerInvoker`
   - `ViewQueryInvoker`
   - `SubscriptionStream`
