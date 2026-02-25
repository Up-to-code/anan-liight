import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

const navSections: Array<{ title: string; links: Array<{ to: string; label: string }> }> = [
  {
    title: "Overview",
    links: [
      { to: "/", label: "Overview" },
      { to: "/search", label: "Global Search" },
      { to: "/users", label: "Users" }
    ]
  },
  {
    title: "WhatsApp",
    links: [
      { to: "/whatsapp/webhooks", label: "WA Webhooks" },
      { to: "/whatsapp/templates", label: "WA Templates" },
      { to: "/whatsapp/campaigns", label: "WA Campaigns" }
    ]
  },
  {
    title: "Operations",
    links: [
      { to: "/logs/api", label: "API Logs" },
      { to: "/logs/webhooks", label: "Webhook Logs" },
      { to: "/ops/dead-letters", label: "Dead Letters" },
      { to: "/ops/workflows", label: "Workflows" },
      { to: "/ops/circuit-breakers", label: "Circuit Breakers" },
      { to: "/ops/feature-flags", label: "Feature Flags" },
      { to: "/ops/actions", label: "Action Audit" }
    ]
  },
  {
    title: "Business Data",
    links: [
      { to: "/business/partners", label: "Partners" },
      { to: "/business/properties", label: "Properties" },
      { to: "/business/notifications", label: "Notifications" }
    ]
  }
];

export function PageShell(props: { title: string; subtitle?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = (active as HTMLElement | null)?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const submitSearch = () => {
    const q = search.trim();
    navigate(q.length > 0 ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Anan Ops</h1>
        {navSections.map((section) => (
          <nav key={section.title}>
            <h4>{section.title}</h4>
            {section.links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>
      <main className="content">
        <div className="global-search">
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="Search all admin data (press / to focus)"
          />
          <button onClick={submitSearch}>Search</button>
        </div>
        <header className="page-header">
          <h2>{props.title}</h2>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </header>
        {props.children}
      </main>
    </div>
  );
}
