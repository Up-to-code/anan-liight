import { useCallback, useState } from "react";
import { fetchJson } from "../api";
import { useDashboardContext } from "../context";
import { usePolling } from "../usePolling";
import { PageShell } from "../components/PageShell";
import { JsonCard } from "../components/JsonCard";

export function CircuitBreakersPage() {
  const { csrfToken } = useDashboardContext();
  const [data, setData] = useState<unknown>({});
  const [circuit, setCircuit] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const load = useCallback(async () => {
    const result = await fetchJson<unknown>("/api/admin/ops/circuit-breakers");
    setData(result);
  }, []);

  usePolling(load);

  return (
    <PageShell title="Circuit Breakers" subtitle="Inspect and reset circuit state">
      <JsonCard title="Reset Breaker (Destructive)">
        <div className="inline-actions">
          <input value={circuit} onChange={(e) => setCircuit(e.target.value)} placeholder="circuit model" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" />
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="type CONFIRM" />
          <button onClick={() => fetchJson(`/api/admin/ops/circuit-breakers/${encodeURIComponent(circuit)}/reset`, {
            method: "POST",
            csrf: csrfToken,
            body: { reason, confirmation }
          }).then(load)}>Reset</button>
        </div>
      </JsonCard>
      <JsonCard title="Circuit State" data={data} />
    </PageShell>
  );
}
