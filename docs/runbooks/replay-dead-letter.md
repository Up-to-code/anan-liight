# Dead Letter Replay

## Preconditions
1. Root-cause fixed and verified in staging.
2. Replay script dry-run returns valid payload count.

## Steps
1. Read dead letters by scope and time range.
2. Group by operation + idempotency key.
3. Re-submit through same reducer path with original idempotency key.
4. Mark replay outcome and close incident ticket.
