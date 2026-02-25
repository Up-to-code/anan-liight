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

interface CircuitRow {
  circuit: string;
  failures: number;
  status?: string;
  openedAt?: number;
  updatedAt?: number;
}

interface CircuitResponse {
  rows: CircuitRow[];
  nextCursor?: string;
  error?: string;
}

export function CircuitBreakersPage() {
  const { csrfToken } = useDashboardContext();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const query = usePollingQuery<CircuitResponse>(() => fetchJson("/api/admin/ops/circuit-breakers?limit=120"));
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const resetCircuit = async () => {
    setBusy(true);
    try {
      await fetchJson(`/api/admin/ops/circuit-breakers/${encodeURIComponent(target)}/reset`, {
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
      setError(err instanceof Error ? err.message : "Circuit reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Circuit Breakers" subtitle="Inspect model failure counters and reset breakers safely">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="Reset Circuit" subtitle="Destructive action with confirmation">
        <div className="inline-actions">
          <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="circuit model name" />
          <button onClick={() => setOpen(true)}>Open reset modal</button>
        </div>
      </Panel>

      <Panel title="Circuit State" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No circuit breaker rows found"
          columns={[
            { key: "circuit", header: "Circuit", sortable: true, value: (r) => <span className="code">{r.circuit}</span> },
            { key: "failures", header: "Failures", sortable: true, sortValue: (r) => r.failures, value: (r) => r.failures },
            { key: "status", header: "Status", sortable: true, value: (r) => <StatusPill value={r.status ?? "unknown"} /> },
            { key: "openedAt", header: "Opened", sortable: true, sortValue: (r) => r.openedAt ?? 0, value: (r) => formatTime(r.openedAt) },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (r) => r.updatedAt ?? 0, value: (r) => formatTime(r.updatedAt) }
          ]}
        />
      </Panel>

      <ConfirmActionModal
        open={open}
        title="Reset Circuit Breaker"
        reason={reason}
        confirmation={confirmation}
        onReasonChange={setReason}
        onConfirmationChange={setConfirmation}
        onCancel={() => setOpen(false)}
        onConfirm={() => void resetCircuit()}
        busy={busy}
      >
        <p>Target circuit: <strong>{target || "(none)"}</strong></p>
      </ConfirmActionModal>
    </PageShell>
  );
}
