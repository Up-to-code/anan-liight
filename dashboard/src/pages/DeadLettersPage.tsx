import { useMemo, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { formatTime } from "../format";

interface DeadLetterRow {
  deadLetterId: string;
  scope: string;
  operation: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
}

interface DeadLetterResponse {
  rows: DeadLetterRow[];
  nextCursor?: string;
  error?: string;
}

export function DeadLettersPage() {
  const { csrfToken } = useDashboardContext();
  const [scope, setScope] = useState("");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const query = usePollingQuery<DeadLetterResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (scope.trim()) params.set("scope", scope.trim());
    return fetchJson(`/api/admin/ops/dead-letters?${params.toString()}`);
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const replay = async () => {
    setBusy(true);
    try {
      await fetchJson(`/api/admin/ops/dead-letters/${targetId}/replay`, {
        method: "POST",
        csrf: csrfToken,
        body: { reason, confirmation }
      });
      setError("");
      setOpen(false);
      setReason("");
      setConfirmation("");
      await query.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Dead Letters" subtitle="Explore failed operations and replay safely">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}

      <Panel title="Controls">
        <div className="inline-actions">
          <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Filter by scope" />
          <input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="deadLetterId" />
          <button onClick={() => setOpen(true)}>Replay selected</button>
        </div>
      </Panel>

      <Panel title="Dead Letter Events" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          columns={[
            { key: "createdAt", header: "Time", sortable: true, sortValue: (r) => r.createdAt, value: (r) => formatTime(r.createdAt) },
            { key: "deadLetterId", header: "Dead Letter ID", value: (r) => <span className="code">{r.deadLetterId}</span> },
            { key: "scope", header: "Scope", sortable: true, value: (r) => r.scope },
            { key: "operation", header: "Operation", sortable: true, value: (r) => r.operation },
            { key: "errorCode", header: "Code", value: (r) => <StatusPill value={r.errorCode ?? "unknown"} /> },
            { key: "errorMessage", header: "Message", value: (r) => r.errorMessage ?? "-" }
          ]}
          emptyText="No dead letters found"
        />
      </Panel>

      <ConfirmActionModal
        open={open}
        title="Replay Dead Letter"
        reason={reason}
        confirmation={confirmation}
        onReasonChange={setReason}
        onConfirmationChange={setConfirmation}
        onCancel={() => setOpen(false)}
        onConfirm={() => void replay()}
        busy={busy}
      >
        <p>Target deadLetterId: <strong>{targetId || "(none)"}</strong></p>
      </ConfirmActionModal>
    </PageShell>
  );
}
