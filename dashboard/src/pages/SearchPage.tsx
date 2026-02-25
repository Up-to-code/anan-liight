import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface SearchRow {
  scope: string;
  id: string;
  title: string;
  subtitle: string;
  createdAt: number;
}

interface SearchResponse {
  rows: SearchRow[];
  nextCursor: string | null;
  totalApprox: number;
  error?: string;
}

const SCOPES = ["users", "campaigns", "templates", "api_logs", "webhook_logs", "dead_letters", "workflows", "flags", "audit", "partners", "properties", "notifications"] as const;

export function SearchPage() {
  const [params] = useSearchParams();
  const [scope, setScope] = useState("");
  const q = params.get("q") ?? "";
  const query = usePollingQuery<SearchResponse>(() => {
    const qs = new URLSearchParams({ q, limit: "150" });
    if (scope) qs.set("scope", scope);
    return fetchJson(`/api/admin/search?${qs.toString()}`);
  });
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  return (
    <PageShell title="Global Search" subtitle="Cross-scope admin search for users, logs, campaigns, and business records">
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}
      <Panel title="Search Controls">
        <div className="inline-actions">
          <input value={q} readOnly placeholder="Type in top search bar and press Enter" />
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="">All scopes</option>
            {SCOPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>

      <Panel title="Results" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No matches found"
          columns={[
            { key: "createdAt", header: "Time", sortable: true, sortValue: (row) => row.createdAt ?? 0, value: (row) => formatTime(row.createdAt) },
            { key: "scope", header: "Scope", sortable: true, value: (row) => row.scope },
            { key: "title", header: "Title", sortable: true, value: (row) => row.title },
            { key: "subtitle", header: "Detail", value: (row) => row.subtitle },
            { key: "id", header: "ID", value: (row) => <span className="code">{row.id}</span> }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
