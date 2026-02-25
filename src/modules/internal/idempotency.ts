import { randomUUID } from "node:crypto";
import { AppError } from "@lib/errors/app-error";
import type { SpacetimeStore } from "@modules/internal/spacetime-store";
import { TABLE_NAMES } from "@shared/constants";

interface IdempotencyJournalRecord {
  id: string;
  key: string;
  scope: string;
  status: "STARTED" | "COMPLETED" | "FAILED";
  resultJson?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Starts idempotent execution and rejects duplicate keys in same scope.
 * @param store Spacetime store
 * @param key Idempotency key
 * @param scope Logical scope
 * @throws AppError<"IDEMPOTENCY_REPLAY"> when key already exists
 */
export async function startIdempotentExecution(
  store: SpacetimeStore,
  key: string,
  scope: string
): Promise<void> {
  const existing = await store.queryOne<IdempotencyJournalRecord>(TABLE_NAMES.IDEMPOTENCY_JOURNAL, [
    { field: "key", op: "eq", value: key },
    { field: "scope", op: "eq", value: scope }
  ]);

  if (existing) {
    throw new AppError({
      code: "IDEMPOTENCY_REPLAY",
      message: "Idempotent operation replayed",
      payload: { key, scope },
      retryable: false
    });
  }

  const now = Date.now();
  await store.insert(TABLE_NAMES.IDEMPOTENCY_JOURNAL, {
    id: randomUUID(),
    key,
    scope,
    status: "STARTED",
    version: 1,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * Marks idempotent execution as completed.
 * @param store Spacetime store
 * @param key Idempotency key
 * @param scope Logical scope
 * @param result Result payload
 */
export async function completeIdempotentExecution(
  store: SpacetimeStore,
  key: string,
  scope: string,
  result: Record<string, unknown>
): Promise<void> {
  const existing = await store.queryOne<IdempotencyJournalRecord>(TABLE_NAMES.IDEMPOTENCY_JOURNAL, [
    { field: "key", op: "eq", value: key },
    { field: "scope", op: "eq", value: scope }
  ]);

  if (!existing) return;

  await store.updateVersioned(TABLE_NAMES.IDEMPOTENCY_JOURNAL, existing.id, existing.version, {
    status: "COMPLETED",
    resultJson: JSON.stringify(result),
    version: existing.version + 1,
    updatedAt: Date.now()
  });
}
