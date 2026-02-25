import { FormEvent, useCallback, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function WhatsAppTemplatesPage() {
  const { csrfToken } = useDashboardContext();
  const [data, setData] = useState<unknown>({});
  const [templateId, setTemplateId] = useState("");

  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/whatsapp/templates");
    setData(result);
  }, []);

  usePolling(load);

  const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetchJson("/api/admin/whatsapp/templates", {
      method: "POST",
      csrf: csrfToken,
      body: {
        name: form.get("name"),
        language: form.get("language"),
        category: form.get("category"),
        body: form.get("body"),
        variables: String(form.get("variables") ?? "").split(",").map((item) => item.trim()).filter(Boolean)
      }
    });
    await load();
  };

  return (
    <PageShell title="WhatsApp Templates" subtitle="Create, submit, and sync template lifecycle">
      <JsonCard title="Template Controls">
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
          <button type="submit">Create Template</button>
        </form>
        <div className="inline-actions">
          <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="templateId" />
          <button onClick={() => fetchJson(`/api/admin/whatsapp/templates/${templateId}/submit`, { method: "POST", csrf: csrfToken }).then(load)}>Submit</button>
          <button onClick={() => fetchJson(`/api/admin/whatsapp/templates/${templateId}/sync`, { method: "POST", csrf: csrfToken, body: { providerStatus: "approved" } }).then(load)}>Sync Approved</button>
        </div>
      </JsonCard>
      <JsonCard title="Templates" data={data} />
    </PageShell>
  );
}
