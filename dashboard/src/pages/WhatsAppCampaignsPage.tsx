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

interface CampaignRow {
  campaignId: string;
  name: string;
  status: string;
  messageKind: string;
  audience: string[];
  scheduledAt?: number;
  updatedAt: number;
}

interface CampaignResponse {
  rows: CampaignRow[];
  nextCursor?: string;
  error?: string;
}

export function WhatsAppCampaignsPage() {
  const { csrfToken } = useDashboardContext();
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState("");

  const query = usePollingQuery<CampaignResponse>(() => fetchJson("/api/admin/whatsapp/campaigns?limit=120"));
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
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
      setError("");
      await query.refresh();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign creation failed");
    }
  };

  const mutate = async (action: "run" | "pause" | "resume" | "cancel") => {
    try {
      await fetchJson(`/api/admin/whatsapp/campaigns/${campaignId}/${action}`, { method: "POST", csrf: csrfToken });
      setError("");
      await query.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign action failed");
    }
  };

  return (
    <PageShell title="WhatsApp Campaigns" subtitle="Lifecycle controls for campaign delivery">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}

      <Panel title="Create Campaign">
        <form onSubmit={createCampaign} className="form-grid">
          <input name="name" placeholder="Campaign name" required />
          <select name="messageKind" defaultValue="text">
            <option value="text">text</option>
            <option value="template">template</option>
            <option value="image">image</option>
            <option value="document">document</option>
            <option value="reaction">reaction</option>
          </select>
          <input name="body" placeholder="Message body" required />
          <input name="audience" placeholder="201000000000,201000000001" required />
          <button type="submit">Create</button>
        </form>
      </Panel>

      <Panel title="Campaign Actions">
        <div className="inline-actions">
          <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} placeholder="campaignId" />
          <button onClick={() => void mutate("run")}>Run</button>
          <button onClick={() => void mutate("pause")}>Pause</button>
          <button onClick={() => void mutate("resume")}>Resume</button>
          <button onClick={() => void mutate("cancel")}>Cancel</button>
        </div>
      </Panel>

      <Panel title="Campaigns" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No campaigns found"
          columns={[
            { key: "campaignId", header: "Campaign ID", value: (r) => <span className="code">{r.campaignId}</span> },
            { key: "name", header: "Name", sortable: true, value: (r) => r.name },
            { key: "status", header: "Status", sortable: true, value: (r) => <StatusPill value={r.status} /> },
            { key: "kind", header: "Kind", sortable: true, value: (r) => r.messageKind },
            { key: "audience", header: "Audience", sortable: true, sortValue: (r) => r.audience.length, value: (r) => r.audience.length },
            { key: "scheduledAt", header: "Scheduled", sortable: true, sortValue: (r) => r.scheduledAt ?? 0, value: (r) => formatTime(r.scheduledAt) },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (r) => r.updatedAt, value: (r) => formatTime(r.updatedAt) }
          ]}
        />
      </Panel>
    </PageShell>
  );
}
