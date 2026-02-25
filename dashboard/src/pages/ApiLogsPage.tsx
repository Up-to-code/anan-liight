import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function ApiLogsPage() {
  const [data, setData] = useState<unknown>({});
  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/logs/api?limit=100");
    setData(result);
  }, []);
  usePolling(load);

  return (
    <PageShell title="API Logs" subtitle="Recent request and error events">
      <JsonCard title="API Event Log" data={data} />
    </PageShell>
  );
}
