import type { ErrorCode } from "@shared/errors";

export interface DeadLetterRecord {
  deadLetterId: string;
  scope: string;
  operation: string;
  idempotencyKey: string;
  errorCode: ErrorCode;
  errorMessage: string;
  payload: Record<string, string>;
  createdAt: number;
}

export interface DeadLetterWriter {
  write(record: DeadLetterRecord): Promise<void>;
}
