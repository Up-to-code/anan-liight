import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function WhatsAppWebhooksPage() {
  const [data, setData] = useState<unknown>({});
  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/logs/webhooks?limit=100");
    setData(result);
  }, []);
  usePolling(load);

  return (
    <PageShell title="WhatsApp Webhooks" subtitle="Verification and inbound processing telemetry">
      <JsonCard title="Webhook Events" data={data} />
    </PageShell>
  );
}
