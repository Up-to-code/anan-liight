import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function FeatureFlagsPage() {
  const { csrfToken } = useDashboardContext();
  const [data, setData] = useState<unknown>({});
  const [flagKey, setFlagKey] = useState("");

  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/ops/feature-flags");
    setData(result);
  }, []);

  usePolling(load);

  return (
    <PageShell title="Feature Flags" subtitle="Toggle runtime feature controls">
      <JsonCard title="Toggle Flag">
        <div className="inline-actions">
          <input value={flagKey} onChange={(e) => setFlagKey(e.target.value)} placeholder="flag key" />
          <button onClick={() => fetchJson(`/api/admin/ops/feature-flags/${encodeURIComponent(flagKey)}/toggle`, { method: "POST", csrf: csrfToken }).then(load)}>
            Toggle
          </button>
        </div>
      </JsonCard>
      <JsonCard title="Feature Flag State" data={data} />
    </PageShell>
  );
}
