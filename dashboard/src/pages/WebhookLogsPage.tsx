import { useMemo, useState } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface WebhookRow {
  eventId?: string;
  eventType?: string;
  status?: string;
  signatureValid?: boolean;
  messageId?: string;
  phoneNumber?: string;
  errorCode?: string;
  createdAt?: number;
}

interface WebhookResponse {
  rows: WebhookRow[];
  nextCursor?: string;
  error?: string;
}

export function WebhookLogsPage() {
  const [status, setStatus] = useState("");
  const query = usePollingQuery<WebhookResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (status) params.set("status", status);
    return fetchJson(`/api/admin/logs/webhooks?${params.toString()}`);
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  return (
    <PageShell title="Webhook Logs" subtitle="Meta WhatsApp webhook verification and processing">
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}
      <Panel title="Filters">
        <div className="inline-actions">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="accepted">accepted</option>
            <option value="rejected">rejected</option>
            <option value="disabled">disabled</option>
          </select>
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>
      <Panel title="Webhook Events" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No webhook events found"
          columns={[
            { key: "createdAt", header: "Time", sortable: true, sortValue: (r) => r.createdAt ?? 0, value: (r) => formatTime(r.createdAt) },
            { key: "eventType", header: "Event", sortable: true, value: (r) => r.eventType ?? "-" },
            { key: "status", header: "Status", sortable: true, value: (r) => <StatusPill value={r.status ?? "unknown"} /> },
            { key: "signatureValid", header: "Signature", value: (r) => <StatusPill value={r.signatureValid ? "valid" : "invalid"} /> },
            { key: "messageId", header: "Message ID", value: (r) => <span className="code">{r.messageId ?? "-"}</span> },
            { key: "phoneNumber", header: "Phone", value: (r) => r.phoneNumber ?? "-" },
            { key: "errorCode", header: "Error", value: (r) => r.errorCode ?? "-" }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
