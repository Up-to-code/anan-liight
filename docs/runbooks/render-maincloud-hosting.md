# Render + Maincloud Hosting Runbook

## Goal
Deploy ANAN-LIIGHT API on Render and keep SpacetimeDB on Maincloud.

## Required Settings
1. `SPACETIMEDB_HTTP_URL=https://maincloud.spacetimedb.com`
2. `SPACETIMEDB_WS_URL=wss://maincloud.spacetimedb.com`
3. `SPACETIMEDB_DB_NAME=anan-liight-debjf`
4. `FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED=false`
5. `FEATURE_LLIGHT_READ_CUTOVER_ENABLED=false`
6. `FEATURE_LLIGHT_WA_WEBHOOK_ENABLED=true`
7. Rotate `WHATSAPP_VERIFY_TOKEN` (minimum 16 chars, not default values).

## Render Service
Use `/Users/ahmedmansour/anan/anan-liight/render.yaml`.

- Build: `npm install && npm run build`
- Start: `npm run start`
- Health: `/health/live`

## Deploy Steps
1. Connect repo in Render.
2. Apply env vars from `render.yaml` and set secret env vars in Render UI.
3. Deploy service.
4. Validate:
   - `GET /health/live` => `200`
   - `GET /health/ready` => `200`
5. Run DB apply from project root:
   - `npm run db:preflight:staging`
   - `npm run db:apply:staging`

## WhatsApp Webhook Setup
1. Callback URL in Meta:
   - `https://<render-domain>/api/webhook/whatsapp`
2. Verify token in Meta must match `WHATSAPP_VERIFY_TOKEN` exactly.
3. Validate handshake from CLI:
   - `bash scripts/webhook-verify-smoke.sh https://<render-domain> <WHATSAPP_VERIFY_TOKEN>`

## 403 / 401 / 404 Matrix
1. `403` on GET verify: token mismatch.
2. `401` on POST: signature mismatch, fix `WHATSAPP_APP_SECRET`.
3. `404` on webhook route: `FEATURE_LLIGHT_WA_WEBHOOK_ENABLED` disabled.
