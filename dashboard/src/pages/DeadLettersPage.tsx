import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function DeadLettersPage() {
  const { csrfToken } = useDashboardContext();
  const [data, setData] = useState<unknown>({});
  const [deadLetterId, setDeadLetterId] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/ops/dead-letters?limit=100");
    setData(result);
  }, []);

  usePolling(load);

  return (
    <PageShell title="Dead Letters" subtitle="Inspect and replay failed operations">
      <JsonCard title="Replay">
        <div className="inline-actions">
          <input value={deadLetterId} onChange={(e) => setDeadLetterId(e.target.value)} placeholder="deadLetterId" />
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="type CONFIRM" />
          <button onClick={() => fetchJson(`/api/admin/ops/dead-letters/${deadLetterId}/replay`, { method: "POST", csrf: csrfToken, body: { reason: "operator replay", confirmation } }).then(load)}>Replay</button>
        </div>
      </JsonCard>
      <JsonCard title="Dead Letter Events" data={data} />
    </PageShell>
  );
}
