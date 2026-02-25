import { AGENTS_TABLE } from "@tables/agents.table";
import { AUTH_TABLES } from "@tables/auth.table";
import { CHAT_MESSAGES_TABLE } from "@tables/chat.table";
import { ERRORS_TABLE } from "@tables/errors.table";
import { IDEMPOTENCY_TABLE } from "@tables/idempotency.table";
import { MESSAGES_TABLE } from "@tables/messages.table";
import { OUTBOX_TABLE } from "@tables/outbox.table";
import { PARITY_CORE_TABLES } from "@tables/parity-core.table";
import { SCHEDULER_TABLE } from "@tables/scheduler.table";
import { SYSTEM_TABLES } from "@tables/system.table";
import { WHATSAPP_PLATFORM_TABLES } from "@tables/whatsapp-platform.table";
import { WORKFLOWS_TABLES } from "@tables/workflows.table";
import type { TableDefinition } from "@tables/types";

export const CORE_TABLE_DEFINITIONS: TableDefinition[] = [
  AGENTS_TABLE,
  ...AUTH_TABLES,
  CHAT_MESSAGES_TABLE,
  ...WORKFLOWS_TABLES,
  SCHEDULER_TABLE,
  MESSAGES_TABLE,
  ERRORS_TABLE,
  IDEMPOTENCY_TABLE,
  OUTBOX_TABLE,
  ...PARITY_CORE_TABLES,
  ...WHATSAPP_PLATFORM_TABLES,
  ...SYSTEM_TABLES
];
