# ANAN-LIIGHT Architecture

## Purpose
ANAN-LIIGHT is a SpacetimeDB-first backend clone of the existing Convex runtime, designed for high throughput, deterministic error handling, and dual-run migration safety.

## Layering Rules
1. `api -> modules -> agents/workflows -> lib -> types`
2. No reverse dependency edges.
3. No hidden side effects; all async flows are explicitly tracked.
4. No raw `Error` throws in business flows.

## Runtime Components
1. API layer: Fastify routes and middleware for auth, trace id, and rate limiting.
2. Modules: reducer/query/internal orchestration with idempotency journal.
3. Agents: durable lifecycle runtime, scheduler, message bus, supervisor.
4. Workflows: step engine, step state machine, compensation path.
5. Lib: error contracts, retry, queue, observability, config, OpenRouter chain.
6. Tables: durable runtime tables with append-only migration files.
7. WhatsApp platform module: templates, campaigns, compliance, delivery, metrics, feedback, scheduler.

## Cognito Auth
1. Hosted flow endpoints:
   - `GET /auth/login`
   - `GET /auth/callback`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
2. JWT validation uses Cognito JWKS with cache TTL.
3. Session rows persist in `sessionTokens` with revoke/refresh lifecycle.
4. Session token payload is encrypted at rest using `SESSION_ENCRYPTION_KEY`.
4. Canary flags:
   - `FEATURE_AUTH_COGNITO_ENABLED`
   - `FEATURE_AUTH_ANON_CHAT_ENABLED`

## Reliability Guarantees
1. Idempotency key required for mutation entrypoints.
2. Retries are bounded by max attempts and deadline.
3. Terminal failures are dead-lettered.
4. Queue saturation throws typed `QUEUE_FULL` errors.
5. Model chain uses circuit breaker and fallback order.
6. Text contract can run in shadow or enforced mode:
   - `FEATURE_TEXT_CONTRACT_SHADOW`
   - `FEATURE_TEXT_CONTRACT_ENFORCED`
7. Workflow retry rounds:
   - 3 immediate retries in step runner
   - 5 scheduled replay rounds via durable scheduler + replay worker
8. Model circuit state persisted in `circuit_breaker_state`.

## Operations
1. Liveness: `GET /health/live`
2. Readiness: `GET /health/ready`
3. Graceful shutdown drains worker queue before exit.

## Feature Flags
1. `FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED`
2. `FEATURE_LLIGHT_WORKFLOW_ENGINE_ENABLED`
3. `FEATURE_LLIGHT_WA_WEBHOOK_ENABLED`
4. `FEATURE_LLIGHT_OPENROUTER_CHAIN_ENABLED`
5. `FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED`
6. `FEATURE_LLIGHT_READ_CUTOVER_ENABLED`
