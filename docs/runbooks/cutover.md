# Cutover Runbook
## Pre-Cutover Bootstrap Stage
1. Apply staging schema and runtime bootstrap only:
   - `npm run db:apply:staging`
2. Confirm artifact is clean:
   - `/Users/ahmedmansour/anan/anan-liight/test-results/spacetimedb-apply.staging.json`
3. Keep both flags OFF in this stage:
   - `FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED=false`
   - `FEATURE_LLIGHT_READ_CUTOVER_ENABLED=false`


## Sequence
1. Deploy anan-liight with dual-run writes disabled.
2. Enable `FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED=true` for 10% traffic.
3. Compare parity dashboards (write success, mismatch ratio, latency).
4. Increase to 25%, 50%, then 100% dual-run.
5. Enable `FEATURE_LLIGHT_READ_CUTOVER_ENABLED=true` in 10/25/50/100 progression.
6. Keep Convex hot standby for rollback window.
7. Auth rollout sequence:
   - enable `FEATURE_AUTH_COGNITO_ENABLED` for `/api/test/*`
   - then `/api/chat`
   - then remaining protected routes
8. Disable `FEATURE_AUTH_ANON_CHAT_ENABLED` only after adoption threshold.
9. Enable text contract in two steps:
   - `FEATURE_TEXT_CONTRACT_SHADOW=true`, `FEATURE_TEXT_CONTRACT_ENFORCED=false`
   - then `FEATURE_TEXT_CONTRACT_ENFORCED=true` after pass/fail metrics stabilize.
10. WhatsApp platform rollout:
    - `FEATURE_LLIGHT_WA_PLATFORM_ENABLED=true` with campaigns disabled
    - then `FEATURE_LLIGHT_WA_CAMPAIGNS_ENABLED=true` for canary
    - keep `FEATURE_LLIGHT_WA_TEMPLATE_ENFORCEMENT_ENABLED=true` in production.

## Rollback
1. Disable read cutover flag.
2. Keep dual-run writes enabled for reconciliation.
3. Drain failed retries and replay dead letters.
