import type { TableDefinition } from "@tables/types";

export const PARITY_CORE_TABLES: TableDefinition[] = [
  {
    tableName: "threadMetadata",
    createSql:
      "CREATE TABLE IF NOT EXISTS threadMetadata (id TEXT PRIMARY KEY, threadId TEXT UNIQUE, userId TEXT, channel TEXT, status TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_thread_metadata_user ON threadMetadata(userId)",
      "CREATE INDEX IF NOT EXISTS idx_thread_metadata_status ON threadMetadata(status)"
    ]
  },
  {
    tableName: "userProfiles",
    createSql:
      "CREATE TABLE IF NOT EXISTS userProfiles (id TEXT PRIMARY KEY, userId TEXT UNIQUE, phoneNumber TEXT, name TEXT, locale TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON userProfiles(phoneNumber)",
      "CREATE INDEX IF NOT EXISTS idx_user_profiles_locale ON userProfiles(locale)"
    ]
  },
  {
    tableName: "partners",
    createSql:
      "CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, partnerId TEXT UNIQUE, name TEXT, apiKeyHash TEXT, isActive BOOLEAN, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_partners_api_hash ON partners(apiKeyHash)",
      "CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(isActive)"
    ]
  },
  {
    tableName: "properties",
    createSql:
      "CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, propertyId TEXT UNIQUE, partnerId TEXT, title TEXT, address TEXT, description TEXT, price DOUBLE, beds INTEGER, baths INTEGER, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_properties_partner ON properties(partnerId)",
      "CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price)"
    ]
  },
  {
    tableName: "notifications",
    createSql:
      "CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, title TEXT, message TEXT, audience TEXT, priority TEXT, status TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience)",
      "CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority)"
    ]
  },
  {
    tableName: "agentTraces",
    createSql:
      "CREATE TABLE IF NOT EXISTS agentTraces (id TEXT PRIMARY KEY, agentId TEXT, event TEXT, payload TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_agent_traces_agent ON agentTraces(agentId)",
      "CREATE INDEX IF NOT EXISTS idx_agent_traces_event ON agentTraces(event)"
    ]
  },
  {
    tableName: "whatsappInboundEvents",
    createSql:
      "CREATE TABLE IF NOT EXISTS whatsappInboundEvents (id TEXT PRIMARY KEY, providerEventId TEXT UNIQUE, userId TEXT, phoneNumber TEXT, eventType TEXT, text TEXT, status TEXT, error TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_inbound_user ON whatsappInboundEvents(userId)",
      "CREATE INDEX IF NOT EXISTS idx_wa_inbound_phone ON whatsappInboundEvents(phoneNumber)"
    ]
  },
  {
    tableName: "whatsappDeliveryLogs",
    createSql:
      "CREATE TABLE IF NOT EXISTS whatsappDeliveryLogs (id TEXT PRIMARY KEY, phoneNumber TEXT, conversationId TEXT, providerMessageId TEXT, status TEXT, messageType TEXT, error TEXT, retries INTEGER, responseTimeMs INTEGER, campaignId TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_delivery_phone ON whatsappDeliveryLogs(phoneNumber)",
      "CREATE INDEX IF NOT EXISTS idx_wa_delivery_status ON whatsappDeliveryLogs(status)"
    ]
  },
  {
    tableName: "whatsappVoiceConfirmations",
    createSql:
      "CREATE TABLE IF NOT EXISTS whatsappVoiceConfirmations (id TEXT PRIMARY KEY, userId TEXT, phoneNumber TEXT, transcript TEXT, status TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_voice_user ON whatsappVoiceConfirmations(userId)",
      "CREATE INDEX IF NOT EXISTS idx_wa_voice_status ON whatsappVoiceConfirmations(status)"
    ]
  }
];
