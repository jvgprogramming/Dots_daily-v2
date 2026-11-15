"use client";

/**
 * Settings sections that are plain forms over one settings group. Every
 * value here is read by the backend (AppSettings) — nothing is display-only.
 */

import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BoundInput, Card, SaveBar, SELECT_CLASSES, SettingField, ToggleRow, type GroupForm } from "./shared";

// ═══ Facility ═══
export function FacilitySection({ form }: { form: GroupForm }) {
  return (
    <Card title="Facility Profile" description="Shown on reports and official notifications.">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingField label="Facility name" updatedBy={form.entry("facility_name")}>
          <BoundInput form={form} k="facility_name" placeholder="e.g. City Health Office TB Center" />
        </SettingField>
        <SettingField label="Branch / clinic name">
          <BoundInput form={form} k="branch_name" placeholder="e.g. Main DOTS Clinic" />
        </SettingField>
        <SettingField label="Contact email">
          <BoundInput form={form} k="contact_email" type="email" />
        </SettingField>
        <SettingField label="Contact phone">
          <BoundInput form={form} k="contact_phone" />
        </SettingField>
        <div className="sm:col-span-2">
          <SettingField label="Address">
            <BoundInput form={form} k="address" />
          </SettingField>
        </div>
        <SettingField label="Region">
          <BoundInput form={form} k="region" />
        </SettingField>
        <SettingField label="Province">
          <BoundInput form={form} k="province" />
        </SettingField>
        <SettingField label="Municipality / City">
          <BoundInput form={form} k="municipality" />
        </SettingField>
        <SettingField label="Default clinic schedule">
          <BoundInput form={form} k="clinic_schedule" placeholder="e.g. Mon–Fri, 8:00 AM – 5:00 PM" />
        </SettingField>
      </div>
      <SaveBar form={form} />
    </Card>
  );
}

// ═══ Clinical rules ═══
export function ClinicalSection({ form }: { form: GroupForm }) {
  const watch = Number(form.str("risk_watch_below"));
  const high = Number(form.str("risk_high_below"));
  const bandsInvalid = Number.isFinite(watch) && Number.isFinite(high) && high > watch;

  return (
    <div className="space-y-6">
      <Card title="Dose Rules" description="How each logged dose is classified and counted.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField
            label="Late dose threshold (minutes)"
            hint="A dose logged later than this after its scheduled time is recorded as Late."
            updatedBy={form.entry("late_dose_threshold_minutes")}
          >
            <BoundInput form={form} k="late_dose_threshold_minutes" type="number" min={0} max={1440} />
          </SettingField>
          <SettingField
            label="Adherence calculation"
            hint="Applies to every adherence figure: dashboard, monitoring, reports and the mobile app."
            updatedBy={form.entry("adherence_calculation")}
          >
            <select className={SELECT_CLASSES} value={form.str("adherence_calculation")} onChange={(e) => form.set("adherence_calculation", e.target.value)}>
              <option value="taken_plus_late">Taken + Late count toward adherence</option>
              <option value="taken_only">Only on-time Taken counts</option>
            </select>
          </SettingField>
          <SettingField label="Medication reminder times" hint="Comma-separated 24-hour times, e.g. 08:00,20:00. Saved for the mobile app's reminders (not yet read by the app).">
            <BoundInput form={form} k="reminder_times" />
          </SettingField>
        </div>
      </Card>

      <Card title="Risk & Schedule Alerts" description="Thresholds behind the risk banner on Daily Monitoring and the treatments hub.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField label="Watch — adherence below (%)" hint="Amber “Watch” flag." updatedBy={form.entry("risk_watch_below")}>
            <BoundInput form={form} k="risk_watch_below" type="number" min={1} max={100} />
          </SettingField>
          <SettingField label="High risk — adherence below (%)" hint="Red “High risk” flag. Must be at or below Watch." updatedBy={form.entry("risk_high_below")}>
            <BoundInput form={form} k="risk_high_below" type="number" min={0} max={100} />
          </SettingField>
          <SettingField label="Follow-up “due soon” window (days)" hint="Follow-ups within this many days show as Due.">
            <BoundInput form={form} k="followup_due_soon_days" type="number" min={1} max={90} />
          </SettingField>
          <SettingField label="Treatment ending soon (days)" hint="Flags plans this close to their expected end date.">
            <BoundInput form={form} k="approaching_end_days" type="number" min={1} max={90} />
          </SettingField>
        </div>
        {bandsInvalid && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-danger-text">
            <AlertTriangle className="h-3.5 w-3.5" /> High-risk threshold must be at or below the watch threshold.
          </p>
        )}
        <RiskPreview watch={watch} high={high} />
      </Card>
      <SaveBar form={form} />
    </div>
  );
}

function RiskPreview({ watch, high }: { watch: number; high: number }) {
  if (!Number.isFinite(watch) || !Number.isFinite(high) || high > watch) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] font-medium text-text-tertiary">Preview (adherence %)</p>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div className="bg-danger" style={{ width: `${high}%` }} />
        <div className="bg-warning" style={{ width: `${watch - high}%` }} />
        <div className="bg-success" style={{ width: `${100 - watch}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-text-tertiary">
        <span>0</span>
        <span>High risk &lt; {high}% · Watch &lt; {watch}% · On track</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ═══ Inventory ═══
export function InventorySection({ form }: { form: GroupForm }) {
  return (
    <Card title="Medication Inventory" description="Stock thresholds and how verified doses affect stock.">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingField label="Default reorder level" hint="Applied to newly registered medicines with no reorder level entered." updatedBy={form.entry("low_stock_default")}>
          <BoundInput form={form} k="low_stock_default" type="number" min={0} />
        </SettingField>
        <SettingField label="Near-expiry window (days)" hint="Medicines expiring within this window are flagged on the dashboard and inventory." updatedBy={form.entry("near_expiry_days")}>
          <BoundInput form={form} k="near_expiry_days" type="number" min={1} max={730} />
        </SettingField>
      </div>
      <div className="mt-4 space-y-3">
        <ToggleRow
          label="Deduct stock when a dose is verified"
          hint="Verifying a dose subtracts its quantity (default 1) from the medicine's stock and records it in the stock ledger."
          checked={form.bool("auto_deduct_on_verify")}
          onChange={(v) => form.set("auto_deduct_on_verify", v)}
        />
        <ToggleRow
          label="Expiry alerts"
          hint="Show near-expiry and expired medicines in dashboard alerts."
          checked={form.bool("expiry_alert_enabled")}
          onChange={(v) => form.set("expiry_alert_enabled", v)}
        />
      </div>
      <SaveBar form={form} />
    </Card>
  );
}

// ═══ Notifications ═══
const PLACEHOLDERS = ["{patient}", "{count}", "{date}", "{time}"];

export function NotificationsSection({ form }: { form: GroupForm }) {
  const roles = form.str("escalate_to_roles").split(",").map((r) => r.trim()).filter(Boolean);
  const toggleRole = (role: string) => {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    form.set("escalate_to_roles", next.join(","));
  };
  const escalationOn = form.bool("missed_dose_alert");

  return (
    <div className="space-y-6">
      <Card title="Missed-dose Escalation" description="Alert staff when a patient keeps missing doses. Checked every hour.">
        <div className="space-y-4">
          <ToggleRow
            label="Missed-dose alerts"
            hint="Raise an alert in staff notifications when the threshold below is reached."
            checked={escalationOn}
            onChange={(v) => form.set("missed_dose_alert", v)}
          />
          <div className={`grid gap-4 sm:grid-cols-2 ${escalationOn ? "" : "pointer-events-none opacity-50"}`}>
            <SettingField label="Escalate after (consecutive missed days)" hint="0 turns escalation off. One alert per missed streak." updatedBy={form.entry("escalate_after_missed")}>
              <BoundInput form={form} k="escalate_after_missed" type="number" min={0} max={30} />
            </SettingField>
            <SettingField label="Notify roles">
              <div className="flex h-10 items-center gap-2">
                {[
                  { value: "admin", label: "Admins" },
                  { value: "staff", label: "Staff" },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    className={`rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                      roles.includes(r.value)
                        ? "border-primary-300 bg-primary-100/70 text-primary-900"
                        : "border-border-light text-text-secondary hover:border-border-strong"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </SettingField>
            <SettingField label="Quiet hours start" hint="No alerts are sent between start and end; held alerts go out afterwards.">
              <BoundInput form={form} k="quiet_hours_start" type="time" />
            </SettingField>
            <SettingField label="Quiet hours end">
              <BoundInput form={form} k="quiet_hours_end" type="time" />
            </SettingField>
          </div>
        </div>
      </Card>

      <Card title="Message Templates" description={`Placeholders: ${PLACEHOLDERS.join(" ")}`}>
        <div className="space-y-4">
          <SettingField label="Missed-dose alert" hint="{count} = consecutive missed days, {date} = last expected day.">
            <textarea
              rows={2}
              value={form.str("missed_dose_template")}
              onChange={(e) => form.set("missed_dose_template", e.target.value)}
              className="w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-[13.5px] text-text-primary focus:border-primary-600 focus:outline-none focus:ring-[3px] focus:ring-primary-500/[0.12]"
            />
          </SettingField>
          <ToggleRow
            label="Follow-up reminders"
            hint="Alert staff once when a patient's follow-up enters the “due soon” window."
            checked={form.bool("followup_reminder")}
            onChange={(v) => form.set("followup_reminder", v)}
          />
          <SettingField label="Follow-up reminder" hint="{date} = follow-up date.">
            <textarea
              rows={2}
              value={form.str("followup_template")}
              onChange={(e) => form.set("followup_template", e.target.value)}
              className="w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-[13.5px] text-text-primary focus:border-primary-600 focus:outline-none focus:ring-[3px] focus:ring-primary-500/[0.12]"
            />
          </SettingField>
        </div>
      </Card>

      <Card
        title="Delivery Channels"
        description="Staff alerts above always appear in the portal's Notifications page. Email, SMS and push delivery are saved preferences for when those channels are connected."
      >
        <div className="space-y-3">
          <ToggleRow label="Push / mobile alerts" hint="In-app alerts for patients using the mobile app." checked={form.bool("push_enabled")} onChange={(v) => form.set("push_enabled", v)} />
          <ToggleRow label="Email" hint="Account notices and password resets." checked={form.bool("email_enabled")} onChange={(v) => form.set("email_enabled", v)} />
          <ToggleRow label="SMS" hint="Requires an SMS gateway to be configured on the server." checked={form.bool("sms_enabled")} onChange={(v) => form.set("sms_enabled", v)} />
          {form.bool("sms_enabled") && (
            <SettingField label="SMS sender name">
              <Input value={form.str("sms_sender")} onChange={(e) => form.set("sms_sender", e.target.value)} placeholder="e.g. DOTSDAILY" />
            </SettingField>
          )}
        </div>
      </Card>
      <SaveBar form={form} />
    </div>
  );
}

// ═══ Security policy ═══
export function SecurityPolicySection({ form }: { form: GroupForm }) {
  return (
    <Card title="Password & Session Policy" description="Enforced on sign-in, password resets and staff account changes.">
      <div className="grid gap-4 sm:grid-cols-3">
        <SettingField label="Minimum password length" updatedBy={form.entry("password_min_length")}>
          <BoundInput form={form} k="password_min_length" type="number" min={8} max={64} />
        </SettingField>
        <SettingField label="Idle session timeout (minutes)" hint="0 = sessions last the full 12-hour shift." updatedBy={form.entry("session_timeout_minutes")}>
          <BoundInput form={form} k="session_timeout_minutes" type="number" min={0} max={1440} />
        </SettingField>
        <SettingField label="Failed sign-ins before lockout" hint="Per email + device; 15-minute lockout." updatedBy={form.entry("max_login_attempts")}>
          <BoundInput form={form} k="max_login_attempts" type="number" min={3} max={20} />
        </SettingField>
      </div>
      <div className="mt-4">
        <ToggleRow
          label="Audit logging"
          hint="Record changes to patients, treatments, doses, medicines, users and settings. Sign-in events are always recorded."
          checked={form.bool("audit_logging_enabled")}
          onChange={(v) => form.set("audit_logging_enabled", v)}
        />
      </div>
      <SaveBar form={form} />
    </Card>
  );
}

// ═══ Reports ═══
export function ReportsSection({ form }: { form: GroupForm }) {
  return (
    <Card title="Report Defaults" description="Saved preferences for the Reports tab (not yet applied by it).">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingField label="Default date range (days)">
          <select className={SELECT_CLASSES} value={form.str("default_range_days")} onChange={(e) => form.set("default_range_days", e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </SettingField>
        <SettingField label="Default adherence filter">
          <select className={SELECT_CLASSES} value={form.str("default_filter")} onChange={(e) => form.set("default_filter", e.target.value)}>
            <option value="all">All doses</option>
            <option value="taken">Taken</option>
            <option value="late">Late</option>
            <option value="missed">Missed</option>
            <option value="unrecorded">Unrecorded</option>
          </select>
        </SettingField>
        <SettingField label="Export format">
          <select className={SELECT_CLASSES} value={form.str("export_format")} onChange={(e) => form.set("export_format", e.target.value)}>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </SettingField>
        <SettingField label="Report access (roles)" hint="Comma-separated roles that may open Reports.">
          <BoundInput form={form} k="access_roles" />
        </SettingField>
      </div>
      <SaveBar form={form} />
    </Card>
  );
}
