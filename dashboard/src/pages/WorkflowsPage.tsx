import { useMemo, useState } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface WorkflowRow {
  eventId?: string;
  workflowRunId?: string;
  stepId?: string;
  state?: string;
  attempt?: number;
  model?: string;
  errorCode?: string;
  createdAt?: number;
}

interface WorkflowResponse {
  rows: WorkflowRow[];
  nextCursor?: string;
  error?: string;
}

export function WorkflowsPage() {
  const [runId, setRunId] = useState("");
  const [state, setState] = useState("");

  const query = usePollingQuery<WorkflowResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (runId.trim()) params.set("runId", runId.trim());
    if (state.trim()) params.set("state", state.trim());
    return fetchJson(`/api/admin/ops/workflows?${params.toString()}`);
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  return (
    <PageShell title="Workflow Events" subtitle="State transitions, retries, and model execution rounds">
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="Filters">
        <div className="inline-actions">
          <input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="workflowRunId" />
          <input value={state} onChange={(event) => setState(event.target.value)} placeholder="state" />
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>

      <Panel title="Workflow Step Events" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          columns={[
            { key: "createdAt", header: "Time", sortable: true, sortValue: (r) => r.createdAt ?? 0, value: (r) => formatTime(r.createdAt) },
            { key: "workflowRunId", header: "Run", value: (r) => <span className="code">{r.workflowRunId ?? "-"}</span> },
            { key: "stepId", header: "Step", value: (r) => <span className="code">{r.stepId ?? "-"}</span> },
            { key: "state", header: "State", sortable: true, value: (r) => <StatusPill value={r.state ?? "unknown"} /> },
            { key: "attempt", header: "Attempt", sortable: true, sortValue: (r) => r.attempt ?? 0, value: (r) => r.attempt ?? 0 },
            { key: "model", header: "Model", value: (r) => r.model ?? "-" },
            { key: "error", header: "Error", value: (r) => r.errorCode ?? "-" }
          ]}
          emptyText="No workflow events found"
        />
      </Panel>
    </PageShell>
  );
}
