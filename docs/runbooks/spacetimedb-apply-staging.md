# SpacetimeDB Staging Apply Runbook

## Scope
Schema + runtime bootstrap only for `anan-liight` staging profile (`.env.local`).
No dual-run or read cutover in this stage.

## Safety Preconditions
1. `FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED=false`
2. `FEATURE_LLIGHT_READ_CUTOVER_ENABLED=false`
3. Valid Spacetime connection keys in `.env.local`.

## Commands
1. Dry-run:
```bash
cd /Users/ahmedmansour/anan/anan-liight
npm run db:apply:staging:dry
```

2. Actual apply:
```bash
cd /Users/ahmedmansour/anan/anan-liight
npm run db:apply:staging
```

## What the wrapper executes
1. `scripts/spacetime-preflight.ts`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run db:bootstrap`
5. Runtime smoke checks:
   - `GET /health/live`
   - `GET /health/ready`
   - `POST /api/chat` anonymous smoke message

## Apply Artifact
Generated file:
`/Users/ahmedmansour/anan/anan-liight/test-results/spacetimedb-apply.staging.json`

Includes:
1. `timestamp`
2. `database`
3. `totalTablesAttempted`
4. `succeededTables`
5. `failedTables`
6. `firstError`

## Rollback (Flag-Only)
1. Keep cutover flags off.
2. If bootstrap fails, fix env/table issue and rerun.
3. If smoke fails, stop runtime and rerun after dependency fix.

## Optional Deep Validation
```bash
cd /Users/ahmedmansour/anan/anan-liight
npm run test:whatsapp:full:dev
```
