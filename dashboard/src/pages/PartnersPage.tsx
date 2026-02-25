import { FormEvent, useMemo, useState } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { useDashboardContext } from "../context";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { ErrorBanner } from "../components/ErrorBanner";
import { StatusPill } from "../components/StatusPill";
import { formatTime } from "../format";

interface PartnerRow {
  id: string;
  partnerId: string;
  name: string;
  isActive?: boolean;
  updatedAt: number;
}

interface PartnerResponse {
  rows: PartnerRow[];
  nextCursor: string | null;
  totalApprox: number;
  error?: string;
}

export function PartnersPage() {
  const { csrfToken } = useDashboardContext();
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const query = usePollingQuery<PartnerResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (queryText.trim()) params.set("query", queryText.trim());
    return fetchJson(`/api/admin/partners?${params.toString()}`);
  });
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson(`/api/admin/partners/${encodeURIComponent(editing.partnerId)}`, {
        method: "PATCH",
        csrf: csrfToken,
        body: {
          name: String(form.get("name") ?? editing.name),
          isActive: String(form.get("isActive") ?? "true") === "true",
          reason: "partner update",
          confirmation: "CONFIRM"
        }
      });
      setEditing(null);
      setError("");
      await query.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <PageShell title="Partners Admin" subtitle="Manage partner metadata and activation status">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}
      <Panel title="Filters">
        <div className="inline-actions">
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search partner" />
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>
      <Panel title="Partners" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          columns={[
            { key: "partnerId", header: "Partner ID", sortable: true, value: (row) => <button onClick={() => setEditing(row)}>{row.partnerId}</button> },
            { key: "name", header: "Name", sortable: true, value: (row) => row.name },
            { key: "isActive", header: "Active", sortable: true, value: (row) => <StatusPill value={row.isActive === false ? "inactive" : "active"} /> },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (row) => row.updatedAt, value: (row) => formatTime(row.updatedAt) }
          ]}
        />
      </Panel>
      {editing ? (
        <Panel title={`Edit Partner ${editing.partnerId}`}>
          <form className="form-grid" onSubmit={submitEdit}>
            <input name="name" defaultValue={editing.name} placeholder="Name" />
            <select name="isActive" defaultValue={editing.isActive === false ? "false" : "true"}>
              <option value="true">active</option>
              <option value="false">inactive</option>
            </select>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </form>
        </Panel>
      ) : null}
    </PageShell>
  );
}
