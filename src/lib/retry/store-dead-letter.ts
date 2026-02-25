import { randomUUID } from "node:crypto";
import type { DeadLetterRecord, DeadLetterWriter } from "@lib/retry/dead-letter";
import type { SpacetimeStore } from "@modules/internal/spacetime-store";
import { TABLE_NAMES } from "@shared/constants";

export class StoreDeadLetterWriter implements DeadLetterWriter {
  public constructor(private readonly store: SpacetimeStore) {}

  public async write(record: DeadLetterRecord): Promise<void> {
    await this.store.insert(TABLE_NAMES.DEAD_LETTERS, {
      id: randomUUID(),
      ...record,
      payloadJson: JSON.stringify(record.payload),
      version: 1,
      updatedAt: record.createdAt
    });
  }
}
