import { useMemo, useState } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { StatusPill } from "../components/StatusPill";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface ApiLogRow {
  eventId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  latencyMs?: number;
  level?: string;
  traceId?: string;
  createdAt?: number;
}

interface ApiLogResponse {
  rows: ApiLogRow[];
  nextCursor?: string;
  error?: string;
}

export function ApiLogsPage() {
  const [routeFilter, setRouteFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  const query = usePollingQuery<ApiLogResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (routeFilter.trim()) params.set("route", routeFilter.trim());
    if (levelFilter.trim()) params.set("level", levelFilter.trim());
    return fetchJson(`/api/admin/logs/api?${params.toString()}`);
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  return (
    <PageShell title="API Logs" subtitle="Route-level request traces and error responses">
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="Filters">
        <div className="inline-actions">
          <input value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} placeholder="Filter by route" />
          <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
            <option value="">All levels</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>

      <Panel title="Recent API Events" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No API events found"
          columns={[
            { key: "createdAt", header: "Time", sortable: true, sortValue: (row) => row.createdAt ?? 0, value: (row) => formatTime(row.createdAt) },
            { key: "method", header: "Method", sortable: true, value: (row) => row.method ?? "-" },
            { key: "route", header: "Route", sortable: true, value: (row) => row.route ?? "-" },
            { key: "status", header: "Status", sortable: true, sortValue: (row) => row.status ?? 0, value: (row) => <StatusPill value={String(row.status ?? "-")} /> },
            { key: "latency", header: "Latency", sortable: true, sortValue: (row) => row.latencyMs ?? 0, value: (row) => `${row.latencyMs ?? 0} ms` },
            { key: "level", header: "Level", sortable: true, value: (row) => <StatusPill value={row.level ?? "unknown"} /> },
            { key: "trace", header: "Trace", value: (row) => <span className="code">{row.traceId ?? "-"}</span> }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
