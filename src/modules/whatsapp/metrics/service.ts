import type { RuntimeContainer } from "@modules/internal/runtime";
import { TABLE_NAMES } from "@shared/constants";

export async function getWhatsAppPerformance(runtime: RuntimeContainer, limit = 200): Promise<{
  total: number;
  sent: number;
  failed: number;
  avgLatencyMs: number;
}> {
  const rows = await runtime.store.queryMany<{ status: string; responseTimeMs?: number }>(
    TABLE_NAMES.WHATSAPP_DELIVERY_LOGS,
    [],
    limit
  );

  const total = rows.length;
  const sent = rows.filter((row) => row.status === "sent" || row.status === "delivered").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const latencyValues = rows.map((row) => row.responseTimeMs ?? 0).filter((value) => value > 0);
  const avgLatencyMs = latencyValues.length > 0
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : 0;

  return { total, sent, failed, avgLatencyMs };
}
