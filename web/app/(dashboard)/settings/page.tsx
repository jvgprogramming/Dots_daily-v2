"use client";

/**
 * Settings — the admin system control panel.
 *
 * System configuration and operational controls only: facility profile,
 * staff users & role permissions, clinical rules, notification channels,
 * security & audit, and report defaults. No patient data lives here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ClipboardList,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getSettings,
  updateSettings,
  getStaffUsers,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  getAuditData,
} from "@/lib/services/settings";
import type {
  SettingsData,
  SettingsGroup,
  SettingEntry,
  StaffUser,
  StaffRole,
  SettingsModule,
  AuditData,
  UpdateStaffUserPayload,
} from "@/lib/types";

// ─── Section definitions ───
type SectionKey = "facility" | "users" | "clinical" | "notifications" | "security" | "reports";

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; description: string }[] = [
  { key: "facility", label: "Facility", icon: Building2, description: "Clinic identity, contact details, and default schedule." },
  { key: "users", label: "Users & Roles", icon: Users, description: "Manage staff accounts and module access." },
  { key: "clinical", label: "Clinical Rules", icon: ClipboardList, description: "Reminder times, dose thresholds, and adherence rules." },
  { key: "notifications", label: "Notifications", icon: SlidersHorizontal, description: "SMS, email, and push alert channels." },
  { key: "security", label: "Security & Audit", icon: ShieldCheck, description: "Login activity, password policies, and audit log." },
  { key: "reports", label: "Reports", icon: Download, description: "Default ranges, filters, and export preferences." },
];

const ROLE_META: Record<StaffRole, { label: string; variant: "primary" | "success" | "warning" | "default" }> = {
  admin: { label: "Admin", variant: "primary" },
  clinician: { label: "Clinician", variant: "success" },
  nurse: { label: "Nurse", variant: "warning" },
  staff: { label: "Staff", variant: "default" },
};

const MODULE_LABELS: Record<SettingsModule, string> = {
  patients: "Patients",
  treatments: "Treatments",
  monitoring: "Monitoring",
  reports: "Reports",
  settings: "Settings",
};

const ALL_MODULES: SettingsModule[] = ["patients", "treatments", "monitoring", "reports", "settings"];

const SELECT_CLASSES =
  "flex h-10 w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Generic field row ───
function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-tertiary">{hint}</p>}
    </div>
  );
}

// ─── Toggle switch ───
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 disabled:opacity-50 ${
        checked ? "justify-end bg-primary-500" : "justify-start bg-border-strong"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

// ─── Card wrapper ───
function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border-light bg-bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-text-tertiary">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [section, setSection] = useState<SectionKey>("facility");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Draft values per group (local edit state)
  const [drafts, setDrafts] = useState<Partial<Record<SettingsGroup, Record<string, string | boolean>>>>({});
  const [savingGroup, setSavingGroup] = useState<SettingsGroup | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setError("");
    try {
      const res = await getSettings();
      if (res.data) {
        setData(res.data);
        setDrafts({});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const groupEntries = useCallback(
    (group: SettingsGroup): Record<string, SettingEntry> => data?.settings?.[group] ?? {},
    [data]
  );

  const draftValue = (group: SettingsGroup, key: string): string | boolean => {
    const d = drafts[group];
    if (d && key in d) return d[key];
    const v = groupEntries(group)[key]?.value ?? "";
    // Booleans stored as 0/1
    if (v === "0" || v === "1") return v === "1";
    return v;
  };

  const setDraft = (group: SettingsGroup, key: string, value: string | boolean) => {
    setDrafts((prev) => ({ ...prev, [group]: { ...(prev[group] ?? {}), [key]: value } }));
  };

  const isDirty = (group: SettingsGroup) =>
    drafts[group] !== undefined && Object.keys(drafts[group] ?? {}).length > 0;

  const saveGroup = async (group: SettingsGroup) => {
    if (!isDirty(group)) return;
    setSavingGroup(group);
    setError("");
    try {
      const values: Record<string, string | boolean> = {};
      for (const [k, v] of Object.entries(drafts[group] ?? {})) {
        if (typeof v === "boolean") values[k] = v ? "1" : "0";
        else values[k] = String(v);
      }
      const res = await updateSettings(group, values);
      if (res.success) {
        showToast("Settings saved successfully.");
        await loadSettings();
      } else {
        setError(res.message || "Failed to save settings.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingGroup(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          System configuration and operational controls for the clinic.
        </p>
      </div>

      {error && <Alert variant="danger" onClose={() => setError("")}>{error}</Alert>}
      {toast && (
        <Alert variant="success" onClose={() => setToast("")}>
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            {toast}
          </span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* ── Left menu ── */}
        <nav className="space-y-1 self-start rounded-[12px] border border-border-light bg-bg-card p-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-600" : "text-text-tertiary"}`} />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* ── Right content ── */}
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 rounded-[12px]" />
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-secondary">
                {SECTIONS.find((s) => s.key === section)?.description}
              </p>

              {/* ═══ FACILITY ═══ */}
              {section === "facility" && (
                <Card title="Facility Profile" description="Shown on reports and official notifications.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingField label="Facility name">
                      <Input
                        value={String(draftValue("facility", "facility_name"))}
                        onChange={(e) => setDraft("facility", "facility_name", e.target.value)}
                        placeholder="e.g. City Health Office TB Center"
                      />
                    </SettingField>
                    <SettingField label="Branch / clinic name">
                      <Input
                        value={String(draftValue("facility", "branch_name"))}
                        onChange={(e) => setDraft("facility", "branch_name", e.target.value)}
                        placeholder="e.g. Main DOTS Clinic"
                      />
                    </SettingField>
                    <SettingField label="Contact email">
                      <Input
                        type="email"
                        value={String(draftValue("facility", "contact_email"))}
                        onChange={(e) => setDraft("facility", "contact_email", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Contact phone">
                      <Input
                        value={String(draftValue("facility", "contact_phone"))}
                        onChange={(e) => setDraft("facility", "contact_phone", e.target.value)}
                      />
                    </SettingField>
                    <div className="sm:col-span-2">
                      <SettingField label="Address">
                        <Input
                          value={String(draftValue("facility", "address"))}
                          onChange={(e) => setDraft("facility", "address", e.target.value)}
                        />
                      </SettingField>
                    </div>
                    <SettingField label="Region">
                      <Input
                        value={String(draftValue("facility", "region"))}
                        onChange={(e) => setDraft("facility", "region", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Province">
                      <Input
                        value={String(draftValue("facility", "province"))}
                        onChange={(e) => setDraft("facility", "province", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Municipality / City">
                      <Input
                        value={String(draftValue("facility", "municipality"))}
                        onChange={(e) => setDraft("facility", "municipality", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Default clinic schedule">
                      <Input
                        value={String(draftValue("facility", "clinic_schedule"))}
                        onChange={(e) => setDraft("facility", "clinic_schedule", e.target.value)}
                        placeholder="e.g. Mon–Fri, 8:00 AM – 5:00 PM"
                      />
                    </SettingField>
                  </div>
                  <SaveBar
                    group="facility"
                    dirty={isDirty("facility")}
                    saving={savingGroup === "facility"}
                    onSave={saveGroup}
                    onDiscard={() => setDrafts((p) => ({ ...p, facility: undefined }))}
                  />
                </Card>
              )}

              {/* ═══ USERS & ROLES ═══ */}
              {section === "users" && <UsersSection onDataChanged={loadSettings} showToast={showToast} onError={setError} />}

              {/* ═══ CLINICAL RULES ═══ */}
              {section === "clinical" && (
                <Card title="Clinical Rules" description="Defaults applied to the medication and monitoring workflows.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingField
                      label="Medication reminder times"
                      hint="Comma-separated 24h times, e.g. 08:00,12:00,16:00,20:00"
                    >
                      <Input
                        value={String(draftValue("clinical", "reminder_times"))}
                        onChange={(e) => setDraft("clinical", "reminder_times", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Late dose threshold (minutes)" hint="Doses confirmed after this window are marked Late.">
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        value={String(draftValue("clinical", "late_dose_threshold_minutes"))}
                        onChange={(e) => setDraft("clinical", "late_dose_threshold_minutes", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Missed dose grace (hours)" hint="Hours after schedule before a dose counts as Missed.">
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        value={String(draftValue("clinical", "missed_dose_grace_hours"))}
                        onChange={(e) => setDraft("clinical", "missed_dose_grace_hours", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Follow-up reminder (days before)" hint="How far ahead patients are reminded of follow-ups.">
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={String(draftValue("clinical", "followup_reminder_days_before"))}
                        onChange={(e) => setDraft("clinical", "followup_reminder_days_before", e.target.value)}
                      />
                    </SettingField>
                    <SettingField label="Adherence calculation">
                      <select
                        className={SELECT_CLASSES}
                        value={String(draftValue("clinical", "adherence_calculation"))}
                        onChange={(e) => setDraft("clinical", "adherence_calculation", e.target.value)}
                      >
                        <option value="taken_plus_late">Taken + Late count toward adherence</option>
                        <option value="taken_only">Only on-time Taken counts</option>
                      </select>
                    </SettingField>
                    <SettingField label="Default outcome options" hint="Comma-separated list offered in the treatment update flow.">
                      <Input
                        value={String(draftValue("clinical", "outcome_options"))}
                        onChange={(e) => setDraft("clinical", "outcome_options", e.target.value)}
                      />
                    </SettingField>
                  </div>
                  <SaveBar
                    group="clinical"
                    dirty={isDirty("clinical")}
                    saving={savingGroup === "clinical"}
                    onSave={saveGroup}
                    onDiscard={() => setDrafts((p) => ({ ...p, clinical: undefined }))}
                  />
                </Card>
              )}

              {/* ═══ NOTIFICATIONS ═══ */}
              {section === "notifications" && (
                <Card title="Notification Channels" description="How the system reaches staff and patients.">
                  <div className="space-y-4">
                    <ToggleRow
                      label="SMS reminders"
                      hint="Send dose and follow-up reminders by SMS."
                      checked={Boolean(draftValue("notifications", "sms_enabled"))}
                      onChange={(v) => setDraft("notifications", "sms_enabled", v)}
                    />
                    {Boolean(draftValue("notifications", "sms_enabled")) && (
                      <SettingField label="SMS sender name">
                        <Input
                          value={String(draftValue("notifications", "sms_sender"))}
                          onChange={(e) => setDraft("notifications", "sms_sender", e.target.value)}
                          placeholder="e.g. DOTSDAILY"
                        />
                      </SettingField>
                    )}
                    <ToggleRow
                      label="Email reminders"
                      hint="Dose confirmations, follow-ups, and account notices."
                      checked={Boolean(draftValue("notifications", "email_enabled"))}
                      onChange={(v) => setDraft("notifications", "email_enabled", v)}
                    />
                    <ToggleRow
                      label="Push / mobile alerts"
                      hint="In-app alerts for patients using the mobile app."
                      checked={Boolean(draftValue("notifications", "push_enabled"))}
                      onChange={(v) => setDraft("notifications", "push_enabled", v)}
                    />
                    <ToggleRow
                      label="Missed dose notifications"
                      hint="Alert staff when a patient misses a dose beyond the grace window."
                      checked={Boolean(draftValue("notifications", "missed_dose_alert"))}
                      onChange={(v) => setDraft("notifications", "missed_dose_alert", v)}
                    />
                    <ToggleRow
                      label="Follow-up reminders"
                      hint="Remind staff and patients of upcoming follow-up visits."
                      checked={Boolean(draftValue("notifications", "followup_reminder"))}
                      onChange={(v) => setDraft("notifications", "followup_reminder", v)}
                    />
                  </div>
                  <SaveBar
                    group="notifications"
                    dirty={isDirty("notifications")}
                    saving={savingGroup === "notifications"}
                    onSave={saveGroup}
                    onDiscard={() => setDrafts((p) => ({ ...p, notifications: undefined }))}
                  />
                </Card>
              )}

              {/* ═══ SECURITY & AUDIT ═══ */}
              {section === "security" && (
                <div className="space-y-6">
                  <Card title="Password & Session Policy">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SettingField label="Minimum password length">
                        <Input
                          type="number"
                          min={8}
                          max={64}
                          value={String(draftValue("security", "password_min_length"))}
                          onChange={(e) => setDraft("security", "password_min_length", e.target.value)}
                        />
                      </SettingField>
                      <SettingField label="Password expiry (days)" hint="0 = never expire.">
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          value={String(draftValue("security", "password_expiry_days"))}
                          onChange={(e) => setDraft("security", "password_expiry_days", e.target.value)}
                        />
                      </SettingField>
                      <SettingField label="Session timeout (minutes)" hint="0 = no automatic timeout.">
                        <Input
                          type="number"
                          min={0}
                          max={1440}
                          value={String(draftValue("security", "session_timeout_minutes"))}
                          onChange={(e) => setDraft("security", "session_timeout_minutes", e.target.value)}
                        />
                      </SettingField>
                      <SettingField label="Max login attempts" hint="Failed attempts before lockout.">
                        <Input
                          type="number"
                          min={3}
                          max={10}
                          value={String(draftValue("security", "max_login_attempts"))}
                          onChange={(e) => setDraft("security", "max_login_attempts", e.target.value)}
                        />
                      </SettingField>
                    </div>
                    <div className="mt-4">
                      <ToggleRow
                        label="Audit logging"
                        hint="Record changes to settings, users, and clinical records."
                        checked={Boolean(draftValue("security", "audit_logging_enabled"))}
                        onChange={(v) => setDraft("security", "audit_logging_enabled", v)}
                      />
                    </div>
                    <SaveBar
                      group="security"
                      dirty={isDirty("security")}
                      saving={savingGroup === "security"}
                      onSave={saveGroup}
                      onDiscard={() => setDrafts((p) => ({ ...p, security: undefined }))}
                    />
                  </Card>

                  <AuditSection />
                </div>
              )}

              {/* ═══ REPORTS ═══ */}
              {section === "reports" && (
                <Card title="Report Defaults" description="Applied when admins open the Reports tab.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingField label="Default date range (days)">
                      <select
                        className={SELECT_CLASSES}
                        value={String(draftValue("reports", "default_range_days"))}
                        onChange={(e) => setDraft("reports", "default_range_days", e.target.value)}
                      >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                      </select>
                    </SettingField>
                    <SettingField label="Default adherence filter">
                      <select
                        className={SELECT_CLASSES}
                        value={String(draftValue("reports", "default_filter"))}
                        onChange={(e) => setDraft("reports", "default_filter", e.target.value)}
                      >
                        <option value="all">All doses</option>
                        <option value="taken">Taken</option>
                        <option value="late">Late</option>
                        <option value="missed">Missed</option>
                        <option value="unrecorded">Unrecorded</option>
                      </select>
                    </SettingField>
                    <SettingField label="Export format">
                      <select
                        className={SELECT_CLASSES}
                        value={String(draftValue("reports", "export_format"))}
                        onChange={(e) => setDraft("reports", "export_format", e.target.value)}
                      >
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </SettingField>
                    <SettingField label="Report access (roles)" hint="Comma-separated roles that may open Reports.">
                      <Input
                        value={String(draftValue("reports", "access_roles"))}
                        onChange={(e) => setDraft("reports", "access_roles", e.target.value)}
                      />
                    </SettingField>
                  </div>
                  <SaveBar
                    group="reports"
                    dirty={isDirty("reports")}
                    saving={savingGroup === "reports"}
                    onSave={saveGroup}
                    onDiscard={() => setDrafts((p) => ({ ...p, reports: undefined }))}
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Save / discard bar ───
function SaveBar({
  group,
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  group: SettingsGroup;
  dirty: boolean;
  saving: boolean;
  onSave: (g: SettingsGroup) => void;
  onDiscard: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="mt-5 flex items-center justify-end gap-3 border-t border-border-light pt-4">
      <Button variant="ghost" onClick={onDiscard} disabled={saving}>
        Discard
      </Button>
      <Button onClick={() => onSave(group)} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
    </div>
  );
}

// ─── Toggle row ───
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border-light px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-tertiary mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <span
          className={`text-[11px] font-medium uppercase tracking-wider ${
            checked ? "text-success-text" : "text-text-tertiary"
          }`}
        >
          {checked ? "On" : "Off"}
        </span>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Users & Roles section
// ═══════════════════════════════════════════════════════════════════
function UsersSection({
  onDataChanged,
  showToast,
  onError,
}: {
  onDataChanged: () => void;
  showToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getStaffUsers(q || undefined);
      if (res.data) setUsers(res.data.users);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const t = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res = await deleteStaffUser(deleting.id);
      if (res.success) {
        showToast(`User ${deleting.name} removed.`);
        setDeleting(null);
        load(search);
        onDataChanged();
      } else {
        onError(res.message || "Failed to delete user.");
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to delete user.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search staff by name or email…"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-[12px]" />
      ) : (
        <Table
          columns={[
            {
              key: "name",
              header: "User",
              cell: (u: StaffUser) => (
                <div>
                  <p className="font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-tertiary">{u.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              cell: (u: StaffUser) => (
                <Badge variant={ROLE_META[u.role]?.variant ?? "default"} size="sm">
                  {ROLE_META[u.role]?.label ?? u.role}
                </Badge>
              ),
            },
            {
              key: "permissions",
              header: "Module Access",
              className: "min-w-[220px]",
              cell: (u: StaffUser) => (
                <div className="flex flex-wrap gap-1">
                  {(u.permissions ?? []).map((m) => (
                    <span key={m} className="rounded-[6px] bg-bg-subtle px-1.5 py-0.5 text-[11px] text-text-secondary">
                      {MODULE_LABELS[m] ?? m}
                    </span>
                  ))}
                </div>
              ),
            },
            {
              key: "last_login_at",
              header: "Last Login",
              cell: (u: StaffUser) => fmtDateTime(u.last_login_at),
            },
            {
              key: "is_active",
              header: "Status",
              cell: (u: StaffUser) => (
                <Badge variant={u.is_active ? "success" : "default"} size="sm">
                  {u.is_active ? "Active" : "Inactive"}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              cell: (u: StaffUser) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(u)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={users}
          keyExtractor={(u) => u.id}
          emptyMessage={search ? `No staff match "${search}".` : "No staff accounts yet — add the first one."}
        />
      )}

      {/* Add modal */}
      {addOpen && (
        <UserFormModal
          onClose={() => setAddOpen(false)}
          onSaved={(msg) => {
            setAddOpen(false);
            showToast(msg);
            load(search);
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <UserFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            showToast(msg);
            load(search);
          }}
        />
      )}

      {/* Delete confirmation */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Remove user"
        description={deleting ? `${deleting.name} will lose dashboard access.` : undefined}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Add/Edit user modal ───
function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user?: StaffUser;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(user?.role ?? "staff");
  const [permissions, setPermissions] = useState<SettingsModule[]>(
    user?.permissions ?? ALL_MODULES
  );
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleModule = (m: SettingsModule) => {
    setPermissions((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      if (isEdit && user) {
        const payload: UpdateStaffUserPayload = {
          name,
          phone: phone || undefined,
          role,
          permissions,
          is_active: isActive,
        };
        if (password) payload.password = password;
        const res = await updateStaffUser(user.id, payload);
        if (res.success) onSaved(`User ${name} updated.`);
        else setError(res.message || "Failed to update user.");
      } else {
        const res = await createStaffUser({
          name,
          email,
          phone: phone || undefined,
          password,
          role,
          permissions,
          is_active: isActive,
        });
        if (res.success) onSaved(`User ${name} created.`);
        else setError(res.message || "Failed to create user.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = name && email && (isEdit || password.length >= 8);

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={isEdit ? "Edit User" : "Add User"}
      description={isEdit ? user?.email : "Create a staff account with role-based module access."}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </SettingField>
          <SettingField label="Email">
            <Input type="email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)} />
          </SettingField>
          <SettingField label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </SettingField>
          <SettingField label={isEdit ? "New password (optional)" : "Password"} hint={isEdit ? "Leave blank to keep current." : "Minimum 8 characters."}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </SettingField>
          <SettingField label="Role">
            <select className={SELECT_CLASSES} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {(Object.keys(ROLE_META) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </SettingField>
          <SettingField label="Account status">
            <div className="flex h-10 items-center">
              <Toggle checked={isActive} onChange={setIsActive} />
              <span className="ml-3 text-sm text-text-secondary">{isActive ? "Active" : "Inactive"}</span>
            </div>
          </SettingField>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Module access</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_MODULES.map((m) => {
              const on = permissions.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModule(m)}
                  className={`flex items-center justify-between rounded-[8px] border px-3 py-2 text-sm transition-all ${
                    on
                      ? "border-primary-300 bg-primary-50 text-primary-700"
                      : "border-border-light text-text-tertiary hover:border-border-strong"
                  }`}
                >
                  {MODULE_LABELS[m]}
                  {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSubmit}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create User"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Audit section
// ═══════════════════════════════════════════════════════════════════
function AuditSection() {
  const [data, setData] = useState<AuditData | null>(null);
  const [type, setType] = useState<"all" | "logins" | "changes">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAuditData(type)
      .then((res) => {
        if (res.data) setData(res.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <Card title="Audit Log & Login Activity" description="Recent system changes and staff sign-ins.">
      <div className="mb-4 flex gap-2">
        {(["all", "logins", "changes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              type === t ? "bg-primary-500 text-white" : "bg-bg-subtle text-text-secondary hover:bg-border-light"
            }`}
          >
            {t === "all" ? "All" : t === "logins" ? "Logins" : "Changes"}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-48 rounded-[12px]" />
      ) : (data?.entries.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title="No audit entries"
          description="System changes and login activity will appear here."
        />
      ) : (
        <div className="space-y-1.5">
          {data?.entries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-[8px] border border-border-light px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-text-primary">
                  <span className="font-medium">{e.user_name}</span>{" "}
                  <span className="text-text-secondary">{e.description ?? e.action}</span>
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {e.action} {e.ip_address ? `· ${e.ip_address}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-text-tertiary">{fmtDateTime(e.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && (data?.login_activity.length ?? 0) > 0 && (
        <div className="mt-5 border-t border-border-light pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">Recent staff logins</p>
          <div className="space-y-1">
            {data?.login_activity.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">
                  {l.name} <span className="text-xs text-text-tertiary">({ROLE_META[l.role as StaffRole]?.label ?? l.role})</span>
                </span>
                <span className="text-xs text-text-tertiary">{fmtDateTime(l.last_login_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
