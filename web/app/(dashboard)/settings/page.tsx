"use client";

/**
 * Settings — the admin system control panel.
 *
 * System configuration and operational controls only. Every value saved here
 * is read by the backend (App\Support\AppSettings), so a change takes effect
 * on the next request. Sections live in components/features/settings; this
 * page owns navigation, per-group drafts and saving.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Building2,
  Check,
  ClipboardList,
  Download,
  Package,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/services/api";
import { getSettings, updateSettings } from "@/lib/services/settings";
import { invalidateClinicSettings } from "@/lib/hooks/useClinicSettings";
import type { SettingsData, SettingsGroup } from "@/lib/types";
import type { GroupForm } from "@/components/features/settings/shared";
import {
  ClinicalSection,
  FacilitySection,
  InventorySection,
  NotificationsSection,
  ReportsSection,
  SecurityPolicySection,
} from "@/components/features/settings/GroupSections";
import { ProtocolsSection } from "@/components/features/settings/ProtocolsSection";
import { UsersSection } from "@/components/features/settings/UsersSection";
import { SecurityAuditPanels } from "@/components/features/settings/AuditSection";

type SectionKey = "facility" | "users" | "clinical" | "protocols" | "inventory" | "notifications" | "security" | "reports";

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; description: string }[] = [
  { key: "facility", label: "Facility", icon: Building2, description: "Clinic identity, contact details, and default schedule." },
  { key: "users", label: "Users & Roles", icon: Users, description: "Manage staff accounts and module access." },
  { key: "clinical", label: "Clinical Rules", icon: ClipboardList, description: "Late-dose threshold, adherence formula, and risk bands." },
  { key: "protocols", label: "Treatment Protocols", icon: Stethoscope, description: "Regimens, phase lengths, weight-band dosing, and outcomes." },
  { key: "inventory", label: "Inventory", icon: Package, description: "Reorder levels, expiry window, and stock deduction." },
  { key: "notifications", label: "Notifications", icon: BellRing, description: "Missed-dose escalation, quiet hours, and message templates." },
  { key: "security", label: "Security & Audit", icon: ShieldCheck, description: "Password and session policy, login activity, and the audit log." },
  { key: "reports", label: "Reports", icon: Download, description: "Default ranges, filters, and export preferences." },
];

type Drafts = Partial<Record<SettingsGroup, Record<string, string | boolean>>>;

export default function SettingsPage() {
  const [section, setSection] = useState<SectionKey>("facility");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [savingGroup, setSavingGroup] = useState<SettingsGroup | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await getSettings();
      if (res.data) {
        setData(res.data);
        setDrafts({});
      }
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const saveGroup = useCallback(
    async (group: SettingsGroup) => {
      const draft = drafts[group];
      if (!draft || Object.keys(draft).length === 0) return;
      setSavingGroup(group);
      setError("");
      try {
        const values: Record<string, string> = {};
        for (const [k, v] of Object.entries(draft)) values[k] = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
        const res = await updateSettings(group, values);
        if (res.success) {
          invalidateClinicSettings();
          showToast("Settings saved — changes apply immediately.");
          await loadSettings();
        } else {
          setError(res.message || "Failed to save settings.");
        }
      } catch (err: unknown) {
        setError(errorMessage(err, "Failed to save settings."));
      } finally {
        setSavingGroup(null);
      }
    },
    [drafts, loadSettings, showToast]
  );

  /** Build the read/edit handle a section uses for one group. */
  const formFor = useCallback(
    (group: SettingsGroup): GroupForm => {
      const entries = data?.settings?.[group] ?? {};
      const draft = drafts[group] ?? {};
      const raw = (key: string): string | boolean => (key in draft ? draft[key] : entries[key]?.value ?? "");
      return {
        group,
        str: (key) => {
          const v = raw(key);
          return typeof v === "boolean" ? (v ? "1" : "0") : v;
        },
        bool: (key) => {
          const v = raw(key);
          return typeof v === "boolean" ? v : v === "1" || v === "true";
        },
        set: (key, value) => setDrafts((prev) => ({ ...prev, [group]: { ...(prev[group] ?? {}), [key]: value } })),
        entry: (key) => entries[key],
        dirty: Object.keys(draft).length > 0,
        saving: savingGroup === group,
        save: () => saveGroup(group),
        discard: () => setDrafts((prev) => ({ ...prev, [group]: undefined })),
      };
    },
    [data, drafts, savingGroup, saveGroup]
  );

  const unsavedGroups = useMemo(
    () => new Set(Object.entries(drafts).filter(([, d]) => d && Object.keys(d).length > 0).map(([g]) => g)),
    [drafts]
  );
  const passwordMin = Math.max(8, Number(data?.settings?.security?.password_min_length?.value) || 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-lede">System configuration and operational controls for the clinic.</p>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {toast && (
        <Alert variant="success" onClose={() => setToast("")}>
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" />
            {toast}
          </span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left menu — a horizontal scroller on small screens */}
        <nav className="matte-surface flex gap-1 self-start overflow-x-auto rounded-[16px] border p-2 lg:sticky lg:top-4 lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            const unsaved = unsavedGroups.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex shrink-0 items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 lg:w-full ${
                  active ? "bg-primary-100/70 text-primary-900" : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary-600" : "text-text-tertiary"}`} />
                <span className="whitespace-nowrap">{s.label}</span>
                {unsaved && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-warning" title="Unsaved changes" />}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 rounded-[12px]" />
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-secondary">{SECTIONS.find((s) => s.key === section)?.description}</p>

              {section === "facility" && <FacilitySection form={formFor("facility")} />}
              {section === "users" && <UsersSection passwordMin={passwordMin} showToast={showToast} onError={setError} />}
              {section === "clinical" && <ClinicalSection form={formFor("clinical")} />}
              {section === "protocols" && <ProtocolsSection form={formFor("protocols")} />}
              {section === "inventory" && <InventorySection form={formFor("inventory")} />}
              {section === "notifications" && <NotificationsSection form={formFor("notifications")} />}
              {section === "security" && (
                <div className="space-y-6">
                  <SecurityPolicySection form={formFor("security")} />
                  <SecurityAuditPanels onError={setError} showToast={showToast} />
                </div>
              )}
              {section === "reports" && <ReportsSection form={formFor("reports")} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
