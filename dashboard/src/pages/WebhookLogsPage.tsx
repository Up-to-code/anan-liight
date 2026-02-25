import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function WebhookLogsPage() {
  const [data, setData] = useState<unknown>({});
  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/logs/webhooks?limit=100");
    setData(result);
  }, []);
  usePolling(load);

  return (
    <PageShell title="Webhook Logs" subtitle="WhatsApp verification and processing events">
      <JsonCard title="Webhook Event Log" data={data} />
    </PageShell>
  );
}
