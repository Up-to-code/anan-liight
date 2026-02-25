# Convex -> SpacetimeDB Migration Map

## Scope
This file maps current Convex backend tables to SpacetimeDB targets for parity rollout.

| Convex Table | SpacetimeDB Target | Concurrency Field | Idempotency Scope | Retention |
|---|---|---|---|---|
| partners | partners | version | partner-write | long-lived |
| properties | properties | version | property-write | long-lived |
| propertyBanks | property_banks | version | relation-write | long-lived |
| banks | banks | version | bank-write | long-lived |
| bankProducts | bank_products | version | bank-product-write | long-lived |
| adminPendingActions | admin_pending_actions | version | admin-action | 90d |
| developerActions | developer_actions | version | developer-action | 90d |
| developerPropertyLinks | developer_property_links | version | dev-link | long-lived |
| entityMedia | entity_media | version | media-link | long-lived |
| userProfiles | user_profiles | version | profile-upsert | long-lived |
| orders | orders | version | order-write | long-lived |
| conversationReasons | conversation_reasons | version | reason-write | 365d |
| threadMetadata | thread_metadata | version | thread-write | 365d |
| userActivity | user_activity | version | activity-write | 180d |
| searchLogs | search_logs | version | search-log | 90d |
| globalSearchCache | global_search_cache | version | search-cache | ttl |
| propertyDetailCache | property_detail_cache | version | detail-cache | ttl |
| userPropertyExposure | user_property_exposure | version | exposure-track | 24h |
| knowledgeResearch | knowledge_research | version | research-log | 365d |
| notifications | notifications | version | notification-write | 180d |
| reviews | reviews | version | review-write | long-lived |
| favorites | favorites | version | favorite-write | long-lived |
| prompts | prompts | version | prompt-write | long-lived |
| aiSettings | ai_settings | version | ai-settings | long-lived |
| knowledgePages | knowledge_pages | version | knowledge-write | long-lived |
| humanHandoffs | human_handoffs | version | handoff-write | 365d |
| pendingVerifications | pending_verifications | version | verify-request | ttl |
| otpRequests | otp_requests | version | otp-request | ttl |
| verifiedPhones | verified_phones | version | phone-verify | long-lived |
| sessionTokens | session_tokens | version | session-write | ttl |
| adminUsers | admin_users | version | admin-user-write | long-lived |
| adminProfiles | admin_profiles | version | admin-profile-write | long-lived |
| userRoles | user_roles | version | role-write | long-lived |
| agentTraces | agent_traces | version | trace-write | 30d |
| whatsappInboundEvents | whatsapp_inbound_events | version | wa-inbound | 30d |
| whatsappDeliveryLogs | whatsapp_delivery_logs | version | wa-delivery | 30d |
| whatsappVoiceConfirmations | whatsapp_voice_confirmations | version | wa-voice-confirm | 30d |
| agentMemory | agent_memory | version | memory-write | 180d |
| agentMemoryEmbeddings | agent_memory_embeddings | version | embedding-write | 180d |
| entityRelations | entity_relations | version | relation-write | 365d |
| aiTokenUsage | ai_token_usage | version | token-usage | 180d |
| searchAnalytics | search_analytics | version | analytics-write | 180d |

## New Runtime Tables
1. idempotency_journal
2. outbox_events
3. dead_letters
4. scheduler_jobs
5. agent_lifecycle_events
6. workflow_step_events
7. feature_flags
8. chatMessages
