import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function WorkflowsPage() {
  const [data, setData] = useState<unknown>({});
  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/ops/workflows?limit=100");
    setData(result);
  }, []);
  usePolling(load);

  return (
    <PageShell title="Workflow Events" subtitle="Track workflow step transitions and failures">
      <JsonCard title="Workflow Step Events" data={data} />
    </PageShell>
  );
}
