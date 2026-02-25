# Local Stack Runbook (Convex + ANAN-LIIGHT)

## Profiles
1. `convex-local-dev`
2. `liight-local-dev`

## Prerequisites
1. `node`, `npm`, `npx` installed.
2. Convex CLI authenticated (`npx convex login`).
3. Synced env files:
   1. `/Users/ahmedmansour/anan/.env.local`
   2. `/Users/ahmedmansour/anan/anan-liight/.env.local`

## Env Sync
1. Dev profile:
```bash
cd /Users/ahmedmansour/anan
npm run env:sync:convex:dev
```
2. Prod profile:
```bash
cd /Users/ahmedmansour/anan
npm run env:sync:convex:prod
```

## Start Local Stack
```bash
cd /Users/ahmedmansour/anan
npm run dev:local:stack
```

This starts:
1. `npx convex dev --local`
2. `anan-liight` API via `bash anan-liight/scripts/dev-local.sh --profile dev`

## Validate
1. Health live:
```bash
curl -s http://127.0.0.1:4020/health/live
```
2. Health ready:
```bash
curl -s http://127.0.0.1:4020/health/ready
```

## Troubleshooting
1. Missing auth:
```bash
cd /Users/ahmedmansour/anan
npx convex login
```
2. Missing env keys:
```bash
cd /Users/ahmedmansour/anan
npm run check:local:prereqs
```
3. Re-sync env files:
```bash
cd /Users/ahmedmansour/anan
npm run env:sync:convex:all
```

## Staging Spacetime Apply
1. Dry-run apply:
```bash
cd /Users/ahmedmansour/anan/anan-liight
npm run db:apply:staging:dry
```
2. Real apply:
```bash
cd /Users/ahmedmansour/anan/anan-liight
npm run db:apply:staging
```
3. Apply artifact:
`/Users/ahmedmansour/anan/anan-liight/test-results/spacetimedb-apply.staging.json`
