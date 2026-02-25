import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCsrfToken } from "./api";
import { DashboardContext } from "./context";
import { OverviewPage } from "./pages/OverviewPage";
import { WhatsAppWebhooksPage } from "./pages/WhatsAppWebhooksPage";
import { WhatsAppTemplatesPage } from "./pages/WhatsAppTemplatesPage";
import { WhatsAppCampaignsPage } from "./pages/WhatsAppCampaignsPage";
import { ApiLogsPage } from "./pages/ApiLogsPage";
import { WebhookLogsPage } from "./pages/WebhookLogsPage";
import { DeadLettersPage } from "./pages/DeadLettersPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";
import { CircuitBreakersPage } from "./pages/CircuitBreakersPage";
import { FeatureFlagsPage } from "./pages/FeatureFlagsPage";
import { ActionsPage } from "./pages/ActionsPage";

export function App() {
  const [csrfToken, setCsrfToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void getCsrfToken()
      .then((token) => {
        setCsrfToken(token);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to initialize dashboard");
      });
  }, []);

  if (error) {
    return <main className="fatal">Dashboard initialization failed: {error}</main>;
  }

  if (!csrfToken) {
    return <main className="fatal">Loading dashboard…</main>;
  }

  return (
    <DashboardContext.Provider value={{ csrfToken }}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/whatsapp/webhooks" element={<WhatsAppWebhooksPage />} />
        <Route path="/whatsapp/templates" element={<WhatsAppTemplatesPage />} />
        <Route path="/whatsapp/campaigns" element={<WhatsAppCampaignsPage />} />
        <Route path="/logs/api" element={<ApiLogsPage />} />
        <Route path="/logs/webhooks" element={<WebhookLogsPage />} />
        <Route path="/ops/dead-letters" element={<DeadLettersPage />} />
        <Route path="/ops/workflows" element={<WorkflowsPage />} />
        <Route path="/ops/circuit-breakers" element={<CircuitBreakersPage />} />
        <Route path="/ops/feature-flags" element={<FeatureFlagsPage />} />
        <Route path="/ops/actions" element={<ActionsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardContext.Provider>
  );
}
