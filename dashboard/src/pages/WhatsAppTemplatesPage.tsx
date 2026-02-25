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

interface TemplateRow {
  templateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  updatedAt: number;
}

interface TemplateResponse {
  rows: TemplateRow[];
  nextCursor?: string | null;
  error?: string;
}

export function WhatsAppTemplatesPage() {
  const { csrfToken } = useDashboardContext();
  const [error, setError] = useState("");
  const [templateId, setTemplateId] = useState("");

  const query = usePollingQuery<TemplateResponse>(() => fetchJson("/api/admin/whatsapp/templates"));

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      await fetchJson("/api/admin/whatsapp/templates", {
        method: "POST",
        csrf: csrfToken,
        body: {
          name: form.get("name"),
          language: form.get("language"),
          category: form.get("category"),
          body: form.get("body"),
          variables: String(form.get("variables") ?? "").split(",").map((v) => v.trim()).filter(Boolean)
        }
      });
      setError("");
      await query.refresh();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template creation failed");
    }
  };

  const runAction = async (path: string, body?: unknown) => {
    try {
      await fetchJson(path, { method: "POST", csrf: csrfToken, ...(body ? { body } : {}) });
      setError("");
      await query.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template action failed");
    }
  };

  return (
    <PageShell title="WhatsApp Templates" subtitle="Draft, submit, and sync provider status">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="Create Template">
        <form onSubmit={createTemplate} className="form-grid">
          <input name="name" placeholder="Template name" required />
          <input name="language" placeholder="en" required />
          <select name="category" defaultValue="marketing">
            <option value="marketing">marketing</option>
            <option value="utility">utility</option>
            <option value="authentication">authentication</option>
          </select>
          <input name="body" placeholder="Template body" required />
          <input name="variables" placeholder="var1,var2" />
          <button type="submit">Create</button>
        </form>
      </Panel>

      <Panel title="Template Actions" subtitle="Run submit/sync on selected template">
        <div className="inline-actions">
          <input value={templateId} onChange={(event) => setTemplateId(event.target.value)} placeholder="templateId" />
          <button onClick={() => void runAction(`/api/admin/whatsapp/templates/${templateId}/submit`)}>Submit</button>
          <button onClick={() => void runAction(`/api/admin/whatsapp/templates/${templateId}/sync`, { providerStatus: "approved" })}>Sync Approved</button>
        </div>
      </Panel>

      <Panel title="Template Catalog" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No templates found"
          columns={[
            { key: "templateId", header: "Template ID", value: (r) => <span className="code">{r.templateId}</span> },
            { key: "name", header: "Name", sortable: true, value: (r) => r.name },
            { key: "language", header: "Language", sortable: true, value: (r) => r.language },
            { key: "category", header: "Category", sortable: true, value: (r) => r.category },
            { key: "status", header: "Status", sortable: true, value: (r) => <StatusPill value={r.status} /> },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (r) => r.updatedAt, value: (r) => formatTime(r.updatedAt) }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
