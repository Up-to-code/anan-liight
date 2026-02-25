import type { ReactNode } from "react";

export function KpiCard(props: { label: string; value: string | number; hint?: string; accent?: "ok" | "warn" | "danger"; icon?: ReactNode }) {
  return (
    <article className={`kpi-card ${props.accent ?? "ok"}`}>
      <div className="kpi-top">
        <span>{props.label}</span>
        {props.icon ? <span>{props.icon}</span> : null}
      </div>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
}
