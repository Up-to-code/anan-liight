import { useMemo } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { KpiCard } from "../components/KpiCard";
import { Panel } from "../components/Panel";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { SkeletonTable } from "../components/SkeletonTable";

interface OverviewResponse {
  service: string;
  ready: boolean;
  checks: { store: string; queue: string; tableProvisioning?: string };
  whatsapp: { total: number; sent: number; failed: number; avgLatencyMs: number };
  counts: { apiEvents: number; webhookEvents: number; deadLetters: number; workflowEvents: number; circuitBreakers: number; featureFlags: number };
  errors?: string[];
}

export function OverviewPage() {
  const query = usePollingQuery<OverviewResponse>(() => fetchJson("/api/admin/overview"));

  const alerts = useMemo(() => {
    const result: string[] = [];
    if (query.data && !query.data.ready) result.push("System readiness is degraded.");
    if ((query.data?.whatsapp.failed ?? 0) > 0) result.push("WhatsApp failures detected in recent window.");
    if ((query.data?.errors?.length ?? 0) > 0) result.push("Data store errors are present in admin APIs.");
    if ((query.data?.checks.tableProvisioning ?? "ok") === "degraded") result.push("Table provisioning is degraded. Check /api/admin/diagnostics/store.");
    return result;
  }, [query.data]);

  return (
    <PageShell title="Operations Overview" subtitle="Live backend readiness and throughput summary">
      {query.error ? <ErrorBanner message={query.error} /> : null}
      <div className="kpi-grid">
        <KpiCard label="Service" value={query.data?.service ?? "anan-liight"} hint="Deployment target" accent={query.data?.ready ? "ok" : "danger"} />
        <KpiCard label="Readiness" value={query.data?.ready ? "READY" : "DEGRADED"} hint={`store=${query.data?.checks.store ?? "-"}, queue=${query.data?.checks.queue ?? "-"}`} accent={query.data?.ready ? "ok" : "danger"} />
        <KpiCard label="WA Sent" value={query.data?.whatsapp.sent ?? 0} hint={`failed=${query.data?.whatsapp.failed ?? 0}`} accent={(query.data?.whatsapp.failed ?? 0) > 0 ? "warn" : "ok"} />
        <KpiCard label="WA Avg Latency" value={`${query.data?.whatsapp.avgLatencyMs ?? 0} ms`} hint={`total=${query.data?.whatsapp.total ?? 0}`} accent="ok" />
      </div>

      <Panel title="System Checks" subtitle="Health checks and operational counters">
        {query.loading && !query.data ? (
          <SkeletonTable />
        ) : (
          <div className="inline-actions">
            <div><strong>Store:</strong> <StatusPill value={query.data?.checks.store ?? "unknown"} /></div>
            <div><strong>Queue:</strong> <StatusPill value={query.data?.checks.queue ?? "unknown"} /></div>
            <div><strong>Tables:</strong> <StatusPill value={query.data?.checks.tableProvisioning ?? "unknown"} /></div>
            <div><strong>API Events:</strong> {query.data?.counts.apiEvents ?? 0}</div>
            <div><strong>Webhook Events:</strong> {query.data?.counts.webhookEvents ?? 0}</div>
            <div><strong>Dead Letters:</strong> {query.data?.counts.deadLetters ?? 0}</div>
            <div><strong>Circuit Breakers:</strong> {query.data?.counts.circuitBreakers ?? 0}</div>
          </div>
        )}
      </Panel>

      <Panel title="Alerts" subtitle="Operator attention items">
        {alerts.length === 0 ? <StatusPill value="No active alerts" /> : null}
        {alerts.map((alert) => (
          <div key={alert} className="error-banner">{alert}</div>
        ))}
      </Panel>
    </PageShell>
  );
}
