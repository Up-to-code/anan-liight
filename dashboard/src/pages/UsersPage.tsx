import { FormEvent, useMemo, useState } from "react";
import { fetchJson } from "../api";
import { usePollingQuery } from "../usePollingQuery";
import { useDashboardContext } from "../context";
import { PageShell } from "../components/PageShell";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/DataTable";
import { ErrorBanner } from "../components/ErrorBanner";
import { StatusPill } from "../components/StatusPill";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { formatTime } from "../format";

interface UserRow {
  userId: string;
  name: string;
  phoneNumber: string;
  locale: string;
  status: string;
  roles: string[];
  activeSessions: number;
  createdAt: number;
  updatedAt: number;
}

interface UserListResponse {
  rows: UserRow[];
  nextCursor: string | null;
  totalApprox: number;
  error?: string;
}

interface UserDetails {
  userId: string;
  name: string;
  phoneNumber: string;
  locale: string;
  status: string;
  roles: string[];
  metadataJson: string;
  sessions: Array<{ sessionId: string; revoked: boolean; expiresAt: number; createdAt: number; updatedAt: number }>;
}

export function UsersPage() {
  const { csrfToken } = useDashboardContext();
  const [queryText, setQueryText] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmMode, setConfirmMode] = useState<"" | "disable" | "enable" | "revokeSessions">("");

  const query = usePollingQuery<UserListResponse>(() => {
    const params = new URLSearchParams({ limit: "120" });
    if (queryText.trim()) params.set("query", queryText.trim());
    if (role.trim()) params.set("role", role.trim());
    if (status.trim()) params.set("status", status.trim());
    return fetchJson(`/api/admin/users?${params.toString()}`);
  }, { enabled: confirmMode === "" });
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const loadDetails = async (userId: string) => {
    try {
      const response = await fetchJson<UserDetails>(`/api/admin/users/${encodeURIComponent(userId)}`);
      setDetails(response);
      setSelectedUserId(userId);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user details");
    }
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!details) return;
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson(`/api/admin/users/${encodeURIComponent(details.userId)}`, {
        method: "PATCH",
        csrf: csrfToken,
        body: {
          name: String(form.get("name") ?? ""),
          locale: String(form.get("locale") ?? ""),
          phoneNumber: String(form.get("phoneNumber") ?? ""),
          metadataJson: String(form.get("metadataJson") ?? "{}"),
          reason: "profile edit",
          confirmation: "CONFIRM"
        }
      });
      await loadDetails(details.userId);
      await query.refresh();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const submitDestructive = async () => {
    if (!details) return;
    const endpoint = confirmMode === "disable"
      ? `/api/admin/users/${encodeURIComponent(details.userId)}/disable`
      : confirmMode === "enable"
        ? `/api/admin/users/${encodeURIComponent(details.userId)}/enable`
        : `/api/admin/users/${encodeURIComponent(details.userId)}/sessions/revoke-all`;
    try {
      await fetchJson(endpoint, {
        method: "POST",
        csrf: csrfToken,
        body: { reason, confirmation }
      });
      setConfirmMode("");
      setReason("");
      setConfirmation("");
      await loadDetails(details.userId);
      await query.refresh();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const updateRole = async (mode: "grant" | "revoke") => {
    if (!details) return;
    const roleValue = prompt(`Role to ${mode} (example: admin or support):`) ?? "";
    if (!roleValue.trim()) return;
    try {
      await fetchJson(`/api/admin/users/${encodeURIComponent(details.userId)}/roles`, {
        method: "POST",
        csrf: csrfToken,
        body: {
          role: roleValue.trim(),
          mode,
          reason: `role ${mode}`,
          confirmation: "CONFIRM"
        }
      });
      await loadDetails(details.userId);
      await query.refresh();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role action failed");
    }
  };

  return (
    <PageShell title="Users Admin" subtitle="Search, edit, role-manage, disable/enable users, and revoke sessions">
      {error ? <ErrorBanner message={error} /> : null}
      {query.error ? <ErrorBanner message={query.error} /> : null}
      {query.data?.error ? <ErrorBanner message={query.data.error} /> : null}

      <Panel title="User Filters">
        <div className="inline-actions">
          <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search user id / name / phone" />
          <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role (admin/user/support)" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All status</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button onClick={() => void query.refresh()}>Refresh</button>
        </div>
      </Panel>

      <Panel title="Users" subtitle={`Rows: ${rows.length}`}>
        <DataTable
          rows={rows}
          emptyText="No users found"
          columns={[
            { key: "userId", header: "User ID", sortable: true, value: (row) => <button onClick={() => void loadDetails(row.userId)}>{row.userId}</button> },
            { key: "name", header: "Name", sortable: true, value: (row) => row.name || "-" },
            { key: "phone", header: "Phone", sortable: true, value: (row) => row.phoneNumber || "-" },
            { key: "status", header: "Status", sortable: true, value: (row) => <StatusPill value={row.status || "unknown"} /> },
            { key: "roles", header: "Roles", value: (row) => row.roles.join(", ") || "user" },
            { key: "sessions", header: "Sessions", sortable: true, sortValue: (row) => row.activeSessions, value: (row) => String(row.activeSessions) },
            { key: "updatedAt", header: "Updated", sortable: true, sortValue: (row) => row.updatedAt, value: (row) => formatTime(row.updatedAt) }
          ]}
        />
      </Panel>

      {details ? (
        <Panel title={`User Detail: ${details.userId}`} subtitle={`Status: ${details.status} | Roles: ${details.roles.join(", ") || "user"}`}>
          <form onSubmit={saveDetails} className="form-grid">
            <input name="name" defaultValue={details.name} placeholder="Name" />
            <input name="phoneNumber" defaultValue={details.phoneNumber} placeholder="Phone" />
            <input name="locale" defaultValue={details.locale} placeholder="Locale" />
            <input name="metadataJson" defaultValue={details.metadataJson} placeholder="metadataJson" />
            <button type="submit">Save Profile</button>
            <button type="button" onClick={() => void updateRole("grant")}>Grant Role</button>
            <button type="button" onClick={() => void updateRole("revoke")}>Revoke Role</button>
            <button type="button" onClick={() => setConfirmMode("disable")}>Disable User</button>
            <button type="button" onClick={() => setConfirmMode("enable")}>Enable User</button>
            <button type="button" onClick={() => setConfirmMode("revokeSessions")}>Revoke Sessions</button>
          </form>

          <Panel title="Sessions" subtitle={`Rows: ${details.sessions.length}`}>
            <DataTable
              rows={details.sessions}
              columns={[
                { key: "sessionId", header: "Session", value: (row) => <span className="code">{row.sessionId}</span> },
                { key: "revoked", header: "Revoked", sortable: true, value: (row) => <StatusPill value={row.revoked ? "revoked" : "active"} /> },
                { key: "expiresAt", header: "Expires", sortable: true, sortValue: (row) => row.expiresAt, value: (row) => formatTime(row.expiresAt) },
                { key: "updatedAt", header: "Updated", sortable: true, sortValue: (row) => row.updatedAt, value: (row) => formatTime(row.updatedAt) }
              ]}
            />
          </Panel>
        </Panel>
      ) : null}

      <ConfirmActionModal
        open={confirmMode !== ""}
        title={`Confirm ${confirmMode}`}
        reason={reason}
        confirmation={confirmation}
        onReasonChange={setReason}
        onConfirmationChange={setConfirmation}
        onCancel={() => {
          setConfirmMode("");
          setReason("");
          setConfirmation("");
        }}
        onConfirm={() => void submitDestructive()}
      >
        <p>Target user: <strong>{selectedUserId || details?.userId}</strong></p>
      </ConfirmActionModal>
    </PageShell>
  );
}
