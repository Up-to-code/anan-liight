import { useMemo, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface FlagRow {
  flagKey: string;
  enabled: boolean;
  source: string;
  updatedAt: number;
}

interface FlagResponse {
  rows: FlagRow[];
  nextCursor?: string;
  error?: string;
}

export function FeatureFlagsPage() {
  const { csrfToken } = useDashboardContext();
  const [flagKey, setFlagKey] = useState("");
  const [error, setError] = useState("");

  const query = usePollingQuery<FlagResponse>(() => fetchJson("/api/admin/ops/feature-flags?limit=120"));
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const toggle = async () => {
    try {
      await fetchJson(`/api/admin/ops/feature-flags/${encodeURIComponent(flagKey)}/toggle`, { method: "POST", csrf: csrfToken });
      setError("");
      await query.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flag toggle failed");
    }
  };

  return (
    <PageShell title="Feature Flags" subtitle="Runtime feature switches">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="Toggle Feature Flag">
        <div className="inline-actions">
          <input value={flagKey} onChange={(event) => setFlagKey(event.target.value)} placeholder="flag key" />
          <button onClick={() => void toggle()}>Toggle</button>
        </div>
      </Panel>

      <Panel title="Feature Flags" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No feature flags found"
          columns={[
            { key: "flagKey", header: "Flag", sortable: true, value: (r) => <span className="code">{r.flagKey}</span> },
            { key: "enabled", header: "Enabled", sortable: true, sortValue: (r) => (r.enabled ? 1 : 0), value: (r) => <StatusPill value={r.enabled ? "enabled" : "disabled"} /> },
            { key: "source", header: "Source", sortable: true, value: (r) => r.source },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (r) => r.updatedAt, value: (r) => formatTime(r.updatedAt) }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
