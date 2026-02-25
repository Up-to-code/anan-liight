# SpacetimeDB Architecture Map v1 for ANAN-LIIGHT

## Document Scope
This document maps `/Users/ahmedmansour/anan/anan-liight` to official SpacetimeDB concepts and identifies alignment gaps before implementation waves.

- Project scope: backend runtime (`src/*`), scripts (`scripts/*`), and operational docs.
- Language: English.
- Source of truth: official SpacetimeDB docs only.

## Official Source Index
The following links are used as canonical references in this map:

1. [SpacetimeDB Docs Home](https://spacetimedb.com/docs/)
2. [Functions Overview (reducers, tables, views)](https://spacetimedb.com/docs/functions/)
3. [Reducers](https://spacetimedb.com/docs/functions/reducers)
4. [Views](https://spacetimedb.com/docs/functions/views)
5. [Subscriptions](https://spacetimedb.com/docs/subscriptions)
6. [SQL Subscriptions and Subscription Semantics](https://spacetimedb.com/docs/subscriptions/sql-subscriptions)
7. [Tables + Access Permissions](https://spacetimedb.com/docs/tables)
8. [Authentication Overview](https://spacetimedb.com/docs/core-concepts/authentication/)
9. [SpacetimeAuth](https://spacetimedb.com/docs/core-concepts/authentication/spacetimeauth)
10. [Auth0 IdP Guide](https://spacetimedb.com/docs/core-concepts/authentication/Auth0)
11. [CLI Publish / Building and Publishing](https://spacetimedb.com/docs/databases/building-publishing/)
12. [Upgrade Notes](https://spacetimedb.com/docs/upgrade)
13. [Claims](https://spacetimedb.com/docs/core-concepts/authentication/claims)
14. [OIDC and IdP Usage Entry Point](https://spacetimedb.com/docs/core-concepts/authentication/)

Note: legacy links such as `/docs/model/*` and `/docs/auth/*` now resolve to current docs structure above; OIDC and \"using IdPs\" guidance now lives under the authentication section and provider-specific pages.

## 1) Core Primitives

### 1.1 Schema and Tables
SpacetimeDB treats schema as module-defined tables/functions. Table access permissions are set in schema and can be private/public (`public: true|false`) with SQL `GRANT` support for table and row-level control. Source: [Tables + Access Permissions](https://spacetimedb.com/docs/tables).

### 1.2 Reducers / Procedures
Reducers are write procedures that execute atomically in the DB module context. They are the canonical mutation path in SpacetimeDB’s model. Source: [Reducers](https://spacetimedb.com/docs/functions/reducers).

### 1.3 Views and Subscriptions
Views can derive readable projections and can be subscribed to. Subscriptions maintain a server-managed dataflow to clients (SQL subscriptions are supported), with documented subscription semantics for updates and ordering guarantees. Sources: [Views](https://spacetimedb.com/docs/functions/views), [Subscriptions](https://spacetimedb.com/docs/subscriptions), [SQL Subscriptions](https://spacetimedb.com/docs/subscriptions/sql-subscriptions).

### 1.4 Auth and Identity
SpacetimeDB supports auth flows including SpacetimeAuth and third-party IdPs (Auth0 guide available in official docs). Claims are first-class identity context that can be used in authorization decisions. Sources: [Authentication Overview](https://spacetimedb.com/docs/core-concepts/authentication/), [SpacetimeAuth](https://spacetimedb.com/docs/core-concepts/authentication/spacetimeauth), [Auth0 Guide](https://spacetimedb.com/docs/core-concepts/authentication/Auth0), [Claims](https://spacetimedb.com/docs/core-concepts/authentication/claims).

### 1.5 Publish / Versioning / Upgrades
Operationally, modules are built and published by CLI. Upgrades require explicit handling of schema/runtime changes; upgrade notes include behavior changes and incompatibilities to account for during deployment. Sources: [Building and Publishing](https://spacetimedb.com/docs/databases/building-publishing/), [Upgrade Notes](https://spacetimedb.com/docs/upgrade).

## 2) Runtime Model

### 2.1 Server Module Responsibilities
SpacetimeDB module is expected to own schema and mutation/query logic (reducers/views/tables). In the current project this role is currently generated in `spacetimedb/src/index.ts` via `scripts/sync-spacetimedb-module-schema.ts`.

### 2.2 Generated Bindings Responsibilities
SpacetimeDB docs model assumes generated/client bindings for typed interaction and subscriptions. Current code is mostly runtime-side store abstraction (`src/modules/internal/spacetime-store.ts`) and does not yet consume generated bindings for typed reducers/queries.

### 2.3 API Gateway (Fastify) Responsibilities
Fastify remains the integration and policy edge: request validation, auth middleware, webhook ingress, and external route compatibility.

## 3) State and Consistency Model

### 3.1 Idempotency
Current implementation includes idempotency journal behavior in application runtime (`src/modules/internal/idempotency.ts`) and uses idempotency keys in chat/workflows.

### 3.2 Retry and Workflow Safety
Step runner includes immediate + scheduled retry rounds with dead-letter sink (`src/workflows/step-runner.ts`, `src/workflows/step-replay-worker.ts`, `src/lib/retry/store-dead-letter.ts`).

### 3.3 Failure and DLQ
Terminal failures are written to dead-letter tables (`errors`/DLQ paths), which aligns with zero-silent-failure objective.

## 4) Security Model

### 4.1 Token and Session Flow
Current edge auth is Cognito/session middleware (`src/api/middleware/auth.ts`, `src/lib/auth/*`).

### 4.2 Signature Validation
WhatsApp webhook signature verification exists (`src/lib/whatsapp/signature.ts`, `src/modules/whatsapp/webhook/service.ts`).

### 4.3 Role Boundaries
Role enforcement is at API middleware layer (`requireRole`, `requireAdmin`), with no DB-native permission policy wired yet.

## 5) Operations Model

### 5.1 Dev and Publish Workflow
`scripts/bootstrap-core-tables.ts` currently syncs schema file and publishes module via `spacetime publish`.

### 5.2 Upgrade Handling
Upgrade behavior currently depends on CLI publish flags and operator workflow; explicit upgrade checklist exists but should be tied to docs-driven upgrade gates.

### 5.3 Rollout and Rollback
Feature flags exist in env schema for dual-write/read cutover and subsystem toggles.

## 6) Spacetime Concept Mapping Matrix

| Spacetime Concept | Current `anan-liight` Implementation | Status | Risk | Owner | Action | Acceptance Condition | Docs |
|---|---|---|---|---|---|---|---|
| Typed table schema for domain entities | `scripts/sync-spacetimedb-module-schema.ts` generates generic `{ id, payloadJson, version, createdAt, updatedAt }` for every table | mismatch | Loses strong typing and DB-level data constraints | `backend-platform` | Replace generic schema generation with table-specific typed module definitions per domain table. | `spacetimedb/src/index.ts` declares typed fields per core table; no generic payload-only rows for core entities. | [Tables](https://spacetimedb.com/docs/tables) |
| Reducer-driven writes | `src/modules/internal/spacetime-store.ts` executes `spacetime sql` strings per insert/query/update | mismatch | Fragile SQL parsing path and no module-native reducer contract | `backend-platform` | Introduce module reducers for writes and route store mutations through reducer invocations only. | No runtime critical path invokes `spacetime sql` for write operations. | [Reducers](https://spacetimedb.com/docs/functions/reducers) |
| View-driven read projections | Reads are performed by app-layer filtering over JSON payload rows (`queryMany` + filter) | partial | Expensive read amplification and weak query semantics | `backend-platform` | Add module views for common read models (threads/messages/workflow status/WA delivery). | At least core chat/workflow/WA reads use module views instead of app-level JSON filtering. | [Views](https://spacetimedb.com/docs/functions/views) |
| Subscription-driven reads | No Spacetime subscriptions consumed; WS route is placeholder (`src/api/ws/chat-ws.ts`) | missing | No real-time DB-native sync path; polling drift risk | `backend-platform` | Add typed subscription layer for chat timeline and workflow state streams. | `chat-ws` uses subscription stream from Spacetime, not placeholder. | [Subscriptions](https://spacetimedb.com/docs/subscriptions) |
| Permission enforcement model | API middleware enforces auth/roles; DB permissions not formalized in module schema | partial | Over-trust in edge layer; least-privilege not guaranteed in DB | `security-platform` | Define table permissions and DB-side access model for sensitive tables. | Module schema has explicit access permissions and policy tests for restricted tables. | [Tables + Access Permissions](https://spacetimedb.com/docs/tables) |
| Auth source alignment (Cognito vs Spacetime auth options) | Cognito hosted auth/session implemented (`src/lib/auth/*`) | partial | Identity split and future claims mismatch with DB-native auth contexts | `security-platform` | Document and implement explicit split: API auth issuer + DB identity/claims mapping contract. | Written contract + integration tests proving stable claim mapping to tenant/role context. | [Authentication](https://spacetimedb.com/docs/core-concepts/authentication/), [SpacetimeAuth](https://spacetimedb.com/docs/core-concepts/authentication/spacetimeauth), [Auth0](https://spacetimedb.com/docs/core-concepts/authentication/Auth0), [Claims](https://spacetimedb.com/docs/core-concepts/authentication/claims) |
| Webhook ingestion and verification | WhatsApp callback and signature verification in API + webhook module | aligned | Replay/dup race remains possible if idempotency checks are bypassed | `messaging-platform` | Keep current verification and add explicit duplicate-event contract tests at webhook boundary. | GET verify and signed POST tests pass with duplicate-event idempotency assertions. | [Authentication / Claims](https://spacetimedb.com/docs/core-concepts/authentication/claims) |
| Publish/migration strategy | CLI publish in bootstrap script; upgrade path exists in ops docs | partial | Upgrade-time conflict or destructive publish misuse | `platform-ops` | Formalize publish runbook with upgrade gates tied to official upgrade notes and migration checklist. | Published runbook includes pre-upgrade checks, rollback path, and conflict policy; used in CI release job. | [Building and Publishing](https://spacetimedb.com/docs/databases/building-publishing/), [Upgrade](https://spacetimedb.com/docs/upgrade) |
| Subscription semantics handling | No explicit handling of semantic guarantees in app flow | missing | Incorrect assumptions on ordering/completeness during realtime adoption | `backend-platform` | Add subscription semantics doc + contract tests for ordering and dedup in consumers. | Subscription consumer tests validate semantics assumptions and dedup logic. | [SQL Subscriptions](https://spacetimedb.com/docs/subscriptions/sql-subscriptions) |

## 7) WhatsApp Webhook Readiness (Locked)

### 7.1 Callback URL Format
- Callback URL: `https://<PUBLIC_API_HOST>/api/webhook/whatsapp`
- Route constant currently maps to `/api/webhook/whatsapp` in `src/types/constants.ts`.

### 7.2 Verification Handshake
- Valid token and `hub.mode=subscribe` must echo `hub.challenge` with `200`.
- Invalid token must return `403`.
- Invalid payload should return `400`.

### 7.3 Signed POST Processing
- Signature header `x-hub-signature-256` validated via HMAC SHA-256.
- Invalid signature rejected (service returns `accepted: false`).
- Valid payload proceeds to normalized inbound processing.

### 7.4 Readiness Test Matrix
1. Verify endpoint with valid token.
2. Verify endpoint with invalid token.
3. Signed POST accepted.
4. Signed POST with invalid signature rejected.
5. Duplicate event idempotency check.
6. Policy-constrained response checks (message budget/link policy).

## 8) Platform-Fit Risk Summary

### Critical
1. SQL CLI store path is still core runtime write/read path (`src/modules/internal/spacetime-store.ts`).
2. Generic payload schema generation prevents strong domain typing in module.
3. No DB subscription integration for live read paths.

### Medium
1. DB permission model not formalized while API auth is active.
2. Publish/upgrade process needs explicit mandatory gates tied to official upgrade guidance.

### Low
1. Existing webhook verification path is mostly aligned and should be hardened with deterministic duplicate-event tests.

## 9) Decision Output
This architecture map is decision-complete for backlog execution in waves. The implementation backlog is documented in:

- `/Users/ahmedmansour/anan/anan-liight/docs/spacetimedb-backlog-v1.md`
