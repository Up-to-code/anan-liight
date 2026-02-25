# Parity Matrix v1.4 (Convex -> ANAN-LIIGHT)

## Status Legend
1. `Complete`: implemented and wired in runtime.
2. `Partial`: implemented but reduced surface compared to Convex.
3. `Missing`: no equivalent module yet.

## Agent Topology
| Convex Module | ANAN-LIIGHT Module | Status | Notes |
|---|---|---|---|
| `convex/agents/anan/agent.ts` | `anan-liight/src/agents/agent-core.ts` + runtime wiring | Partial | Core lifecycle exists, ANAN-specific facade still thinner. |
| `convex/agents/anan/context/*` | `anan-liight/src/agents/anan/context/*` | Missing | Must add prioritizer/context composer parity. |
| `convex/agents/anan/results/*` | `anan-liight/src/agents/anan/results/*` | Missing | Required for normalized result envelopes. |
| `convex/agents/anan/testing/*` | `anan-liight/src/agents/anan/testing/*` | Missing | Needed for prompt/routing parity regression harness. |

## Prompt Stack
| Convex Module | ANAN-LIIGHT Module | Status | Notes |
|---|---|---|---|
| `instructions/system.ts` | `instructions/system.ts` | Complete | |
| `instructions/routing.ts` | `instructions/routing.ts` | Complete | |
| `instructions/memory.ts` | `instructions/memory.ts` | Complete | |
| `instructions/responseContract.ts` | `instructions/response-contract.ts` | Complete | Naming differs only. |
| `instructions/channels.ts` | `instructions/channels.ts` | Complete | |
| Legacy split files (`searchRules`, `realEstate`, etc.) | N/A | Intentional | ANAN-LIIGHT uses consolidated v0.0.9 pattern. |

## Search/Orchestration
| Convex Module | ANAN-LIIGHT Module | Status | Notes |
|---|---|---|---|
| `search/searchOrchestrator.ts` | `search/pipeline.ts` | Partial | Pipeline exists, stage-level split still reduced. |
| `search/queryPlanner.ts` | `search/*` | Partial | Needs dedicated planner/retriever/judge modules. |
| `search/detailEnricher.ts` | `search/*` | Partial | Needs explicit top-K enrichment stage parity. |
| `search/coverageJudge.ts` | `search/*` | Partial | Coverage metrics present but simplified. |

## Tools
| Convex Tool Family | ANAN-LIIGHT Tool Module | Status | Notes |
|---|---|---|---|
| Property search/details/cache | `tools/property.ts` | Partial | Current implementation is minimal. |
| Web search/info | `tools/web.ts` | Partial | Basic shape exists. |
| Memory/profile | `tools/memory.ts` | Partial | Persist call exists; retrieval parity missing. |
| Formatting | `tools/format.ts` | Partial | Basic formatter only. |
| Finance/loan | `tools/finance.ts` | Missing | Add calculators + bundle routing. |
| Handoff/sales | `tools/handoff.ts` | Missing | Add request + order-draft logic parity. |
| Analysis/judgement | `tools/analysis.ts` | Missing | Add search quality and response validation tools. |

## Workflow/Reliability
| Convex Capability | ANAN-LIIGHT Module | Status | Notes |
|---|---|---|---|
| Retry/fallback model chain | `src/lib/openrouter/*` | Complete | Circuit + retry wired. |
| 3 immediate + 5 scheduled replay | `src/workflows/step-runner.ts` + replay worker | Complete | DLQ path included. |
| Durable scheduler/message bus | `src/agents/agent-scheduler.ts`, `agent-message-bus.ts` | Complete | |
| Idempotency journal | `src/modules/internal/idempotency.ts` | Complete | |

## WhatsApp Platform
| Convex Capability | ANAN-LIIGHT Module | Status | Notes |
|---|---|---|---|
| Webhook verify/process | `modules/whatsapp/webhook/service.ts` + `/api/webhook/whatsapp` | Complete | |
| Template lifecycle | `modules/whatsapp/templates/service.ts` | Complete | |
| Campaigns | `modules/whatsapp/campaigns/service.ts` | Complete | Adaptive throttling included. |
| Compliance (24h window) | `modules/whatsapp/compliance/service.ts` | Complete | Template-only enforcement ready. |
| Metrics/feedback | `modules/whatsapp/metrics/service.ts`, `feedback/service.ts` | Complete | |

## Route Compatibility
| Route | ANAN-LIIGHT | Status |
|---|---|---|
| `POST /api/chat` | Present | Complete |
| `POST /api/partner/properties` | Present | Complete |
| `POST /api/test/agent-reply` | Present | Complete |
| `POST /api/test/column` | Present | Complete |
| `GET/POST /api/webhook/whatsapp` | Present | Complete |

## Immediate Backlog (Execution Order)
1. Add missing `context/*`, `results/*`, `testing/*` modules in `anan-liight/src/agents/anan`.
2. Expand tool families with `finance.ts`, `handoff.ts`, `analysis.ts` and wire into orchestrator.
3. Split search pipeline into explicit stage modules with typed contracts.
4. Add parity tests mirroring Convex prompt/routing and WhatsApp policy tests.
