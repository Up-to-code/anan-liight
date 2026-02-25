import type { ReactNode } from "react";

export function JsonCard(props: { title: string; children?: ReactNode; data?: unknown }) {
  return (
    <section className="card">
      <h3>{props.title}</h3>
      {props.children}
      {typeof props.data !== "undefined" ? <pre>{JSON.stringify(props.data, null, 2)}</pre> : null}
    </section>
  );
}
