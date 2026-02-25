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

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  audience?: string;
  priority?: string;
  status?: string;
  updatedAt: number;
}

interface NotificationResponse {
  rows: NotificationRow[];
  nextCursor: string | null;
  totalApprox: number;
  error?: string;
}

export function NotificationsPage() {
  const { csrfToken } = useDashboardContext();
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<NotificationRow | null>(null);
  const query = usePollingQuery<NotificationResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (queryText.trim()) params.set("query", queryText.trim());
    return fetchJson(`/api/admin/notifications?${params.toString()}`);
  });
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson(`/api/admin/notifications/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        csrf: csrfToken,
        body: {
          title: String(form.get("title") ?? editing.title),
          message: String(form.get("message") ?? editing.message),
          audience: String(form.get("audience") ?? editing.audience ?? "all"),
          priority: String(form.get("priority") ?? editing.priority ?? "NORMAL"),
          status: String(form.get("status") ?? editing.status ?? "draft"),
          reason: "notification update",
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
    <PageShell title="Notifications Admin" subtitle="Manage outbound notification records">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}
      <Panel title="Filters">
        <div className="inline-actions">
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search by title/message/status" />
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>
      <Panel title="Notifications" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          columns={[
            { key: "id", header: "ID", value: (row) => <button onClick={() => setEditing(row)}>{row.id}</button> },
            { key: "title", header: "Title", sortable: true, value: (row) => row.title },
            { key: "audience", header: "Audience", sortable: true, value: (row) => row.audience ?? "-" },
            { key: "priority", header: "Priority", sortable: true, value: (row) => row.priority ?? "-" },
            { key: "status", header: "Status", sortable: true, value: (row) => <StatusPill value={row.status ?? "unknown"} /> },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (row) => row.updatedAt, value: (row) => formatTime(row.updatedAt) }
          ]}
        />
      </Panel>
      {editing ? (
        <Panel title={`Edit Notification ${editing.id}`}>
          <form className="form-grid" onSubmit={submitEdit}>
            <input name="title" defaultValue={editing.title} placeholder="Title" />
            <input name="message" defaultValue={editing.message} placeholder="Message" />
            <input name="audience" defaultValue={editing.audience ?? "all"} placeholder="Audience" />
            <input name="priority" defaultValue={editing.priority ?? "NORMAL"} placeholder="Priority" />
            <input name="status" defaultValue={editing.status ?? "draft"} placeholder="Status" />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </form>
        </Panel>
      ) : null}
    </PageShell>
  );
}
