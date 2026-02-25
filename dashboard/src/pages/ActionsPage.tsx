import { FormEvent, useMemo, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface AuditRow {
  actionId?: string;
  actorUserId?: string;
  actionType?: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  result?: string;
  createdAt?: number;
}

interface AuditResponse {
  rows: AuditRow[];
  nextCursor?: string;
  error?: string;
}

export function ActionsPage() {
  const { csrfToken } = useDashboardContext();
  const [error, setError] = useState("");
  const query = usePollingQuery<AuditResponse>(() => fetchJson("/api/admin/actions/audit?limit=120"));

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const execute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson("/api/admin/actions/execute", {
        method: "POST",
        csrf: csrfToken,
        body: {
          actionType: String(form.get("actionType") ?? ""),
          targetType: String(form.get("targetType") ?? ""),
          targetId: String(form.get("targetId") ?? ""),
          reason: String(form.get("reason") ?? ""),
          confirmation: String(form.get("confirmation") ?? ""),
          payload: {
            key: String(form.get("key") ?? ""),
            value: String(form.get("value") ?? "")
          }
        }
      });
      setError("");
      await query.refresh();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <PageShell title="Admin Actions" subtitle="Execute controlled destructive actions and inspect immutable audit">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="Execute Action">
        <form onSubmit={execute} className="form-grid">
          <input name="actionType" placeholder="feature_flag_toggle" required />
          <input name="targetType" placeholder="feature_flag" required />
          <input name="targetId" placeholder="target id" required />
          <input name="reason" placeholder="reason" required />
          <input name="confirmation" placeholder="Type CONFIRM" required />
          <input name="key" placeholder="payload key" />
          <input name="value" placeholder="payload value" />
          <button type="submit">Execute</button>
        </form>
      </Panel>

      <Panel title="Action Audit" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No action audit rows found"
          columns={[
            { key: "createdAt", header: "Time", sortable: true, sortValue: (r) => r.createdAt ?? 0, value: (r) => formatTime(r.createdAt) },
            { key: "actionId", header: "Action ID", value: (r) => <span className="code">{r.actionId ?? "-"}</span> },
            { key: "actor", header: "Actor", sortable: true, value: (r) => r.actorUserId ?? "-" },
            { key: "actionType", header: "Action", sortable: true, value: (r) => r.actionType ?? "-" },
            { key: "target", header: "Target", value: (r) => `${r.targetType ?? "-"}:${r.targetId ?? "-"}` },
            { key: "reason", header: "Reason", value: (r) => r.reason ?? "-" },
            { key: "result", header: "Result", sortable: true, value: (r) => <StatusPill value={r.result ?? "unknown"} /> }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
