import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function OverviewPage() {
  const [data, setData] = useState<unknown>({});
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const result = await fetchJson<unknown>("/api/admin/overview");
      setData(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    }
  }, []);

  usePolling(load);

  return (
    <PageShell title="Operations Overview" subtitle="Live backend and WhatsApp status">
      <JsonCard title="Overview" data={data} />
      {error ? <p className="error">{error}</p> : null}
    </PageShell>
  );
}
