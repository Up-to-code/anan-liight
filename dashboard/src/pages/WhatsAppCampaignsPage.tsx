import { FormEvent, useCallback, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function WhatsAppCampaignsPage() {
  const { csrfToken } = useDashboardContext();
  const [data, setData] = useState<unknown>({});
  const [campaignId, setCampaignId] = useState("");

  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/whatsapp/campaigns?limit=100");
    setData(result);
  }, []);

  usePolling(load);

  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetchJson("/api/admin/whatsapp/campaigns", {
      method: "POST",
      csrf: csrfToken,
      body: {
        name: form.get("name"),
        messageKind: form.get("messageKind"),
        payload: { body: String(form.get("body") ?? "") },
        audience: String(form.get("audience") ?? "").split(",").map((item) => item.trim()).filter(Boolean)
      }
    });
    await load();
  };

  return (
    <PageShell title="WhatsApp Campaigns" subtitle="Create, run, pause, resume, and cancel campaigns">
      <JsonCard title="Campaign Controls">
        <form onSubmit={createCampaign} className="form-grid">
          <input name="name" placeholder="Campaign name" required />
          <select name="messageKind" defaultValue="text">
            <option value="text">text</option>
            <option value="template">template</option>
            <option value="image">image</option>
          </select>
          <input name="body" placeholder="Message body" required />
          <input name="audience" placeholder="201000000000,201000000001" required />
          <button type="submit">Create Campaign</button>
        </form>
        <div className="inline-actions">
          <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="campaignId" />
          <button onClick={() => fetchJson(`/api/admin/whatsapp/campaigns/${campaignId}/run`, { method: "POST", csrf: csrfToken }).then(load)}>Run</button>
          <button onClick={() => fetchJson(`/api/admin/whatsapp/campaigns/${campaignId}/pause`, { method: "POST", csrf: csrfToken }).then(load)}>Pause</button>
          <button onClick={() => fetchJson(`/api/admin/whatsapp/campaigns/${campaignId}/resume`, { method: "POST", csrf: csrfToken }).then(load)}>Resume</button>
          <button onClick={() => fetchJson(`/api/admin/whatsapp/campaigns/${campaignId}/cancel`, { method: "POST", csrf: csrfToken }).then(load)}>Cancel</button>
        </div>
      </JsonCard>
      <JsonCard title="Campaigns" data={data} />
    </PageShell>
  );
}
