import pino, { type Logger } from "pino";

export interface LogContext {
  traceId: string;
  tenantId?: string;
  agentId?: string;
  workflowRunId?: string;
  idempotencyKey?: string;
}

export const logger: Logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime
});

/**
 * Creates child logger with normalized operational context.
 * @param context Structured tracing context
 * @returns Child logger
 */
export function withLogContext(context: LogContext): Logger {
  return logger.child(context);
}
