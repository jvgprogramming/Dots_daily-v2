"use client";

/**
 * Security & Audit: per-staff login activity (with sign-out-everywhere) and
 * the filterable, paginated audit trail with before/after diffs and CSV export.
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Download, Loader2, LogOut, RefreshCw, ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { errorMessage } from "@/lib/services/api";
import { exportAuditCsv, getAuditData, getLoginActivity, revokeStaffSessions } from "@/lib/services/settings";
import type { AuditArea, AuditData, AuditEntry, AuditFilters, LoginActivityData, LoginActivityRow } from "@/lib/types";
import { Card, fmtDateTime, SELECT_CLASSES } from "./shared";
import { ROLE_META } from "./UsersSection";

const AREAS: { value: AuditArea; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "logins", label: "Sign-ins" },
  { value: "failed_logins", label: "Failed sign-ins" },
  { value: "auth", label: "Sign-outs & resets" },
  { value: "patients", label: "Patients" },
  { value: "treatments", label: "Treatments" },
  { value: "doses", label: "Dose verification" },
  { value: "medications", label: "Medicines" },
  { value: "users", label: "Staff accounts" },
  { value: "settings", label: "Settings" },
];

/** Badge tone per action family. */
function actionTone(action: string): "success" | "warning" | "danger" | "primary" | "default" {
  if (action === "login.success") return "success";
  if (action.startsWith("login.")) return "danger";
  if (action.endsWith(".deleted") || action.endsWith(".archived") || action === "user.sessions_revoked") return "warning";
  if (action.startsWith("settings.")) return "primary";
  return "default";
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s === "1" ? "On / 1" : s === "0" ? "Off / 0" : s;
}

export function SecurityAuditPanels({ onError, showToast }: { onError: (m: string) => void; showToast: (m: string) => void }) {
  return (
    <div className="space-y-6">
      <LoginActivityCard onError={onError} showToast={showToast} />
      <AuditLogCard onError={onError} />
    </div>
  );
}

// ─── Login activity ───
function LoginActivityCard({ onError, showToast }: { onError: (m: string) => void; showToast: (m: string) => void }) {
  const [data, setData] = useState<LoginActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<LoginActivityRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLoginActivity();
      if (res.data) setData(res.data);
    } catch (err) {
      onError(errorMessage(err, "Failed to load login activity"));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await revokeStaffSessions(revoking.id);
      showToast(`${revoking.name} was signed out of all sessions.`);
      setRevoking(null);
      load();
    } catch (err) {
      onError(errorMessage(err, "Failed to sign out sessions"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Login Activity"
      description="Staff sign-ins, active sessions and failed attempts in the last 24 hours."
      action={
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label="Refresh login activity">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      {loading && !data ? (
        <Skeleton className="h-40 rounded-[12px]" />
      ) : (
        <>
          {data && (data.failed_logins_24h > 0 || data.unknown_email_attempts_24h > 0) && (
            <div className="mb-3 flex items-center gap-2 rounded-[10px] bg-warning-bg px-3 py-2 text-xs text-warning-text">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {data.failed_logins_24h} failed sign-in{data.failed_logins_24h === 1 ? "" : "s"} in the last 24 h
              {data.unknown_email_attempts_24h > 0 && ` · ${data.unknown_email_attempts_24h} for emails with no staff account`}
            </div>
          )}
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                  <th className="pb-2 pr-3">Staff</th>
                  <th className="pb-2 pr-3">Last sign-in</th>
                  <th className="pb-2 pr-3">From IP</th>
                  <th className="pb-2 pr-3">Failed (24 h)</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => (
                  <tr key={u.id} className="border-t border-border-light">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-text-primary">{u.name}</p>
                      <p className="text-[11px] text-text-tertiary">
                        {u.email} · {ROLE_META[u.role]?.label ?? u.role}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-xs text-text-secondary">{fmtDateTime(u.last_login_at)}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-text-tertiary">{u.last_login_ip ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs tabular-nums ${u.failed_attempts_24h > 0 ? "font-semibold text-danger-text" : "text-text-tertiary"}`}>
                        {u.failed_attempts_24h}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {!u.is_active ? (
                        <Badge variant="default" size="sm">Inactive</Badge>
                      ) : u.active_sessions > 0 ? (
                        <Badge variant="success" size="sm">Signed in</Badge>
                      ) : (
                        <Badge variant="outline" size="sm">Signed out</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {u.active_sessions > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setRevoking(u)}>
                          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={revoking !== null}
        onClose={() => !busy && setRevoking(null)}
        title="Sign out all sessions"
        description={revoking ? `${revoking.name} will be signed out on every device and must sign in again.` : undefined}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setRevoking(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={revoke} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

// ─── Audit log ───
function AuditLogCard({ onError }: { onError: (m: string) => void }) {
  const [filters, setFilters] = useState<AuditFilters>({ area: "all", page: 1, per_page: 25 });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Debounce the free-text search into the filters
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === search ? f : { ...f, search, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAuditData(filters)
      .then((res) => {
        if (!cancelled && res.data) setData(res.data);
      })
      .catch((err) => !cancelled && onError(errorMessage(err, "Failed to load audit log")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, onError]);

  const set = (patch: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  const doExport = async () => {
    setExporting(true);
    try {
      await exportAuditCsv(filters);
    } catch (err) {
      onError(errorMessage(err, "Export failed"));
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = (filters.area && filters.area !== "all") || filters.user_id || filters.from || filters.to || filters.search;

  return (
    <Card
      title="Audit Log"
      description="Who changed what, when, and from where."
      action={
        <Button variant="outline" size="sm" onClick={doExport} disabled={exporting || (data?.meta.total ?? 0) === 0}>
          {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
          Export CSV
        </Button>
      }
    >
      {data && !data.audit_logging_enabled && (
        <div className="mb-3 flex items-center gap-2 rounded-[10px] bg-warning-bg px-3 py-2 text-xs text-warning-text">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Audit logging is off — only sign-in events are being recorded. Turn it on in Password &amp; Session Policy above.
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input className="pl-9" placeholder="Search description, user or IP…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={SELECT_CLASSES} value={filters.area} onChange={(e) => set({ area: e.target.value as AuditArea })} aria-label="Activity type">
          {AREAS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASSES}
          value={filters.user_id ?? ""}
          onChange={(e) => set({ user_id: e.target.value ? Number(e.target.value) : "" })}
          aria-label="Staff member"
        >
          <option value="">All staff</option>
          {data?.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input type="date" aria-label="From date" value={filters.from ?? ""} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" aria-label="To date" value={filters.to ?? ""} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
      </div>

      <div className="mb-2 flex items-center justify-between text-[11px] text-text-tertiary">
        <span>{data ? `${data.meta.total.toLocaleString()} entr${data.meta.total === 1 ? "y" : "ies"}` : ""}</span>
        {hasFilters && (
          <button
            type="button"
            className="font-medium text-primary-700 hover:underline"
            onClick={() => {
              setSearch("");
              setFilters({ area: "all", page: 1, per_page: filters.per_page });
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && !data ? (
        <Skeleton className="h-64 rounded-[12px]" />
      ) : (data?.entries.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title={hasFilters ? "No matching entries" : "No audit entries yet"}
          description={hasFilters ? "Try a wider date range or another activity type." : "Sign-ins and changes will appear here."}
        />
      ) : (
        <div className={`-mx-1 overflow-x-auto px-1 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                <th className="w-6 pb-2" />
                <th className="pb-2 pr-3">When</th>
                <th className="pb-2 pr-3">Who</th>
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">Details</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {data?.entries.map((e) => (
                <AuditRow key={e.id} entry={e} open={expanded === e.id} onToggle={() => setExpanded((cur) => (cur === e.id ? null : e.id))} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <Pagination className="mt-4" currentPage={data.meta.current_page} totalPages={data.meta.last_page} onPageChange={(page) => set({ page })} />
      )}
    </Card>
  );
}

function AuditRow({ entry: e, open, onToggle }: { entry: AuditEntry; open: boolean; onToggle: () => void }) {
  const changes = e.properties?.changes;
  const extra = Object.entries(e.properties ?? {}).filter(([k]) => k !== "changes");
  const expandable = Boolean((changes && Object.keys(changes).length) || extra.length || e.user_agent);

  return (
    <Fragment>
      <tr className={`border-t border-border-light ${expandable ? "cursor-pointer hover:bg-bg-subtle/60" : ""}`} onClick={expandable ? onToggle : undefined}>
        <td className="py-2 align-top text-text-tertiary">
          {expandable && (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        </td>
        <td className="whitespace-nowrap py-2 pr-3 align-top text-xs text-text-secondary">{fmtDateTime(e.created_at)}</td>
        <td className="py-2 pr-3 align-top font-medium text-text-primary">{e.user_name}</td>
        <td className="py-2 pr-3 align-top">
          <Badge variant={actionTone(e.action)} size="sm">
            {e.action}
          </Badge>
        </td>
        <td className="py-2 pr-3 align-top text-text-secondary">{e.description ?? "—"}</td>
        <td className="py-2 align-top font-mono text-[11px] text-text-tertiary">{e.ip_address ?? "—"}</td>
      </tr>
      {open && (
        <tr className="bg-bg-subtle/50">
          <td />
          <td colSpan={5} className="pb-3 pr-3 pt-1">
            {changes && Object.keys(changes).length > 0 && (
              <table className="mb-2 w-full max-w-2xl text-xs">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-text-tertiary">
                    <th className="py-1 pr-3 text-left font-medium">Field</th>
                    <th className="py-1 pr-3 text-left font-medium">Before</th>
                    <th className="py-1 text-left font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(changes).map(([field, c]) => (
                    <tr key={field} className="border-t border-border-light">
                      <td className="py-1 pr-3 font-medium text-text-secondary">{field.replace(/_/g, " ")}</td>
                      <td className="max-w-[260px] break-words py-1 pr-3 text-danger-text/90 line-through decoration-danger/40">{fmtValue(c.from)}</td>
                      <td className="max-w-[260px] break-words py-1 text-success-text">{fmtValue(c.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {extra.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                {extra.map(([k, v]) => (
                  <span key={k}>
                    <span className="text-text-tertiary">{k.replace(/_/g, " ")}:</span> {fmtValue(v)}
                  </span>
                ))}
              </div>
            )}
            {e.subject_type && (
              <p className="text-[11px] text-text-tertiary">
                Record: {e.subject_type} #{e.subject_id}
              </p>
            )}
            {e.user_agent && <p className="mt-0.5 truncate text-[11px] text-text-tertiary" title={e.user_agent}>Device: {e.user_agent}</p>}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
