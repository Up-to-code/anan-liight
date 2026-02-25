# Cognito Rollout Runbook

## Required Env
1. `COGNITO_ENABLED=true`
2. `COGNITO_REGION`
3. `COGNITO_USER_POOL_ID`
4. `COGNITO_CLIENT_ID`
5. `COGNITO_DOMAIN`
6. `COGNITO_REDIRECT_URI`
7. `SESSION_ENCRYPTION_KEY`

## Feature Flag Sequence
1. `FEATURE_AUTH_COGNITO_ENABLED=true` for test routes.
2. Enable for `/api/chat` and monitor auth error ratio.
3. Disable `FEATURE_AUTH_ANON_CHAT_ENABLED` after adoption.

## Health Checks
1. `GET /auth/login` returns redirect.
2. `GET /auth/me` returns 401 when unauthenticated.
3. Callback creates valid `anan_session` cookie.
4. Session payload is encrypted in `sessionTokens`.

## Metrics to Watch
1. `auth.login.started`
2. `auth.callback.success` / `auth.callback.failed`
3. `auth.token_validation.success` / `auth.token_validation.failed`
4. `auth.token_validation.latency_ms`
