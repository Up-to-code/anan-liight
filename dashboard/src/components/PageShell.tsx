import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const links = [
  { to: "/", label: "Overview" },
  { to: "/whatsapp/webhooks", label: "WA Webhooks" },
  { to: "/whatsapp/templates", label: "WA Templates" },
  { to: "/whatsapp/campaigns", label: "WA Campaigns" },
  { to: "/logs/api", label: "API Logs" },
  { to: "/logs/webhooks", label: "Webhook Logs" },
  { to: "/ops/dead-letters", label: "Dead Letters" },
  { to: "/ops/workflows", label: "Workflows" },
  { to: "/ops/circuit-breakers", label: "Circuit Breakers" },
  { to: "/ops/feature-flags", label: "Feature Flags" },
  { to: "/ops/actions", label: "Action Audit" }
];

export function PageShell(props: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Anan Ops</h1>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="page-header">
          <h2>{props.title}</h2>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </header>
        {props.children}
      </main>
    </div>
  );
}
