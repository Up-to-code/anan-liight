import { FormEvent, useCallback, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function ActionsPage() {
  const { csrfToken } = useDashboardContext();
  const [audit, setAudit] = useState<unknown>({});

  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/actions/audit?limit=100");
    setAudit(result);
  }, []);

  usePolling(load);

  const execute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetchJson("/api/admin/actions/execute", {
      method: "POST",
      csrf: csrfToken,
      body: {
        actionType: String(form.get("actionType") ?? ""),
        targetType: String(form.get("targetType") ?? ""),
        targetId: String(form.get("targetId") ?? ""),
        reason: String(form.get("reason") ?? ""),
        confirmation: String(form.get("confirmation") ?? ""),
        payload: {
          key: String(form.get("key") ?? ""),
          value: String(form.get("value") ?? "")
        }
      }
    });
    await load();
  };

  return (
    <PageShell title="Admin Actions" subtitle="Generic destructive operations with immutable audit">
      <JsonCard title="Execute Action">
        <form onSubmit={execute} className="form-grid">
          <input name="actionType" placeholder="feature_flag_toggle" required />
          <input name="targetType" placeholder="feature_flag" required />
          <input name="targetId" placeholder="target id" required />
          <input name="reason" placeholder="reason" required />
          <input name="confirmation" placeholder="type CONFIRM" required />
          <input name="key" placeholder="payload key" />
          <input name="value" placeholder="payload value" />
          <button type="submit">Execute</button>
        </form>
      </JsonCard>
      <JsonCard title="Action Audit" data={audit} />
    </PageShell>
  );
}
