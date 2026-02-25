import { FormEvent, useMemo, useState } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { useDashboardContext } from "../context";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatTime } from "../format";

interface PropertyRow {
  id: string;
  propertyId: string;
  title?: string;
  address?: string;
  price?: number;
  beds?: number;
  baths?: number;
  updatedAt: number;
}

interface PropertyResponse {
  rows: PropertyRow[];
  nextCursor: string | null;
  totalApprox: number;
  error?: string;
}

export function PropertiesPage() {
  const { csrfToken } = useDashboardContext();
  const [queryText, setQueryText] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PropertyRow | null>(null);
  const query = usePollingQuery<PropertyResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (queryText.trim()) params.set("query", queryText.trim());
    return fetchJson(`/api/admin/properties?${params.toString()}`);
  });
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson(`/api/admin/properties/${encodeURIComponent(editing.propertyId)}`, {
        method: "PATCH",
        csrf: csrfToken,
        body: {
          title: String(form.get("title") ?? editing.title ?? ""),
          address: String(form.get("address") ?? editing.address ?? ""),
          description: String(form.get("description") ?? ""),
          price: Number(form.get("price") ?? editing.price ?? 0),
          beds: Number(form.get("beds") ?? editing.beds ?? 0),
          baths: Number(form.get("baths") ?? editing.baths ?? 0),
          reason: "property update",
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
    <PageShell title="Properties Admin" subtitle="Control property records and listing details">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}
      <Panel title="Filters">
        <div className="inline-actions">
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search property id/title/address" />
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>
      <Panel title="Properties" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          columns={[
            { key: "propertyId", header: "Property ID", sortable: true, value: (row) => <button onClick={() => setEditing(row)}>{row.propertyId}</button> },
            { key: "title", header: "Title", sortable: true, value: (row) => row.title ?? "-" },
            { key: "address", header: "Address", sortable: true, value: (row) => row.address ?? "-" },
            { key: "price", header: "Price", sortable: true, sortValue: (row) => row.price ?? 0, value: (row) => String(row.price ?? 0) },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (row) => row.updatedAt, value: (row) => formatTime(row.updatedAt) }
          ]}
        />
      </Panel>
      {editing ? (
        <Panel title={`Edit Property ${editing.propertyId}`}>
          <form className="form-grid" onSubmit={submitEdit}>
            <input name="title" defaultValue={editing.title ?? ""} placeholder="Title" />
            <input name="address" defaultValue={editing.address ?? ""} placeholder="Address" />
            <input name="description" placeholder="Description" />
            <input name="price" type="number" defaultValue={editing.price ?? 0} placeholder="Price" />
            <input name="beds" type="number" defaultValue={editing.beds ?? 0} placeholder="Beds" />
            <input name="baths" type="number" defaultValue={editing.baths ?? 0} placeholder="Baths" />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </form>
        </Panel>
      ) : null}
    </PageShell>
  );
}
