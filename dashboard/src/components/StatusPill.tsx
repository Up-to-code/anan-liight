export function StatusPill(props: { value: string }) {
  const normalized = props.value.toLowerCase();
  const tone = normalized.includes("fail") || normalized.includes("error") || normalized.includes("rejected")
    ? "danger"
    : normalized.includes("warn") || normalized.includes("paused") || normalized.includes("scheduled")
      ? "warn"
      : "ok";

  return <span className={`status-pill ${tone}`}>{props.value}</span>;
}
