import { randomUUID } from "node:crypto";
import type { SpacetimeStore } from "@modules/internal/spacetime-store";
import { TABLE_NAMES } from "@shared/constants";

export interface ThreadRecord {
  id: string;
  threadId: string;
  userId: string;
  channel: "web" | "app" | "whatsapp";
  status: "ACTIVE" | "ARCHIVED";
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessageRecord {
  id: string;
  messageId: string;
  threadId: string;
  userId: string;
  role: "user" | "assistant";
  body: string;
  channel: "web" | "app" | "whatsapp";
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface PartnerPropertyRecord {
  id: string;
  propertyId: string;
  partnerId: string;
  title: string;
  address: string;
  description: string;
  price: number;
  beds: number;
  baths: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Creates a chat thread row.
 * @param store Spacetime store
 * @param userId User id
 * @param channel Chat channel
 * @returns New thread id
 */
export async function createThread(
  store: SpacetimeStore,
  userId: string,
  channel: "web" | "app" | "whatsapp"
): Promise<string> {
  const now = Date.now();
  const threadId = randomUUID();

  await store.insert(TABLE_NAMES.THREAD_METADATA, {
    id: randomUUID(),
    threadId,
    userId,
    channel,
    status: "ACTIVE",
    version: 1,
    createdAt: now,
    updatedAt: now
  } satisfies ThreadRecord);

  return threadId;
}

/**
 * Persists user or assistant message row.
 * @param store Spacetime store
 * @param input Message data
 * @returns Stored message id
 */
export async function addMessage(
  store: SpacetimeStore,
  input: Omit<ChatMessageRecord, "id" | "messageId" | "version" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const messageId = randomUUID();
  await store.insert(TABLE_NAMES.CHAT_MESSAGES, {
    id: randomUUID(),
    messageId,
    ...input,
    version: 1,
    createdAt: now,
    updatedAt: now
  } satisfies ChatMessageRecord);
  return messageId;
}

/**
 * Stores partner property row.
 * @param store Spacetime store
 * @param row Property row
 */
export async function addPartnerProperty(
  store: SpacetimeStore,
  row: Omit<PartnerPropertyRecord, "id" | "propertyId" | "version" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const propertyId = randomUUID();
  await store.insert(TABLE_NAMES.PROPERTIES, {
    id: randomUUID(),
    propertyId,
    ...row,
    version: 1,
    createdAt: now,
    updatedAt: now
  } satisfies PartnerPropertyRecord);
  return propertyId;
}
