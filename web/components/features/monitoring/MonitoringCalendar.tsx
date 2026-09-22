"use client";

/**
 * Monitoring Calendar — patient-centric treatment calendar.
 *
 * Month/week grid where each day shows medication adherence status
 * (taken / missed / late / not recorded) plus a marker when a daily
 * monitoring entry exists. Clicking a day opens the detail panel with
 * dose-level data and monitoring notes.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Activity,
  Pill,
  StickyNote,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  AdherenceDay,
  MonitoringEntry,
  MonitoringTreatmentPlan,
  DoseLog,
} from "@/lib/types";

// ─── Adherence status derivation & colors ───
type DayStatus = "taken" | "pending" | "late" | "missed" | "not_recorded" | "none";

function dayStatus(day: AdherenceDay | undefined): DayStatus {
  if (!day) return "none";
  if (day.missed > 0) return "missed";
  // Taken but not yet confirmed by a DOTS observer — the same state the
  // patient's app shows as a "not verified" day.
  if (day.pending > 0) return "pending";
  if (day.late > 0) return "late";
  if (day.taken > 0) return "taken";
  return "not_recorded";
}

const STATUS_STYLES: Record<DayStatus, string> = {
  taken: "bg-success-bg text-success-text border-success/30 hover:border-success",
  pending: "bg-info-bg text-info-text border-info/30 hover:border-info",
  late: "bg-warning-bg text-warning-text border-warning/30 hover:border-warning",
  missed: "bg-danger-bg text-danger-text border-danger/30 hover:border-danger",
  not_recorded: "bg-bg-subtle text-text-tertiary border-border-light hover:border-border-strong",
  none: "bg-bg-card text-text-tertiary border-border-light/50",
};

const STATUS_LABELS: Record<DayStatus, string> = {
  taken: "Taken",
  pending: "Pending verification",
  late: "Late",
  missed: "Missed",
  not_recorded: "Not recorded",
  none: "No doses scheduled",
};

export interface MonitoringCalendarProps {
  /** ISO date of the first day shown in the grid */
  rangeStart: string;
  /** ISO date of the last day shown in the grid */
  rangeEnd: string;
  view: "month" | "week";
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Treatment plan used to grey out days outside the treatment period */
  plan: MonitoringTreatmentPlan | null;
  adherenceByDate: Map<string, AdherenceDay>;
  monitoringByDate: Map<string, MonitoringEntry>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonitoringCalendar({
  rangeStart,
  rangeEnd,
  view,
  onPrev,
  onNext,
  onToday,
  plan,
  adherenceByDate,
  monitoringByDate,
  selectedDate,
  onSelectDate,
}: MonitoringCalendarProps) {
  const days = useMemo(() => {
    const list: Date[] = [];
    const cursor = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T00:00:00");
    while (cursor <= end) {
      list.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return list;
  }, [rangeStart, rangeEnd]);

  const todayISO = toISO(new Date());

  const start = plan?.start_date ?? null;
  const end = plan?.actual_end_date ?? plan?.expected_end_date ?? null;

  return (
    <div className="rounded-[12px] border border-border-light bg-bg-card">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={view === "month" ? "primary" : "default"} size="sm">
            {new Date(rangeStart + "T00:00:00").toLocaleDateString("en-PH", {
              month: "long",
              year: "numeric",
            })}
          </Badge>
        </div>
      </div>

      {/* ── Weekday labels ── */}
      <div className="grid grid-cols-7 border-b border-border-light bg-bg-subtle/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            {d}
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className={`grid grid-cols-7 ${view === "week" ? "min-h-[220px]" : ""}`}>
        {days.map((date) => {
          const iso = toISO(date);
          const day = adherenceByDate.get(iso);
          const status = dayStatus(day);
          const hasMonitoring = monitoringByDate.has(iso);
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;
          const inPlan = !start || !end || (iso >= start && iso <= end);

          return (
            <button
              key={iso}
              onClick={() => onSelectDate(iso)}
              className={`relative m-1 rounded-[8px] border p-2 text-left transition-all duration-150 min-h-[64px] ${STATUS_STYLES[status]} ${
                isSelected ? "ring-2 ring-primary-400/50 border-primary-400" : ""
              } ${!inPlan ? "opacity-35" : ""}`}
            >
              <span className={`text-xs font-semibold ${isToday ? "underline decoration-2 underline-offset-2" : ""}`}>
                {date.getDate()}
              </span>
              {day && (
                <span className="block mt-0.5 text-[10px] leading-tight opacity-80">
                  {day.taken + day.late}/{day.total_doses} doses
                </span>
              )}
              {hasMonitoring && (
                <span
                  className="absolute bottom-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-white"
                  title="Daily monitoring recorded"
                >
                  <Activity className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 border-t border-border-light px-4 py-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">Legend:</span>
        {(["taken", "pending", "late", "missed", "not_recorded"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`h-3 w-3 rounded-[4px] border ${STATUS_STYLES[s]}`} />
            {STATUS_LABELS[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary-500">
            <Activity className="h-2.5 w-2.5 text-white" />
          </span>
          Monitoring recorded
        </span>
      </div>
    </div>
  );
}

// ─── Day detail panel — 4-tab medication detail (no regimen section) ───
type PanelTab = "medication" | "monitoring" | "notes" | "history";

const PANEL_TABS: { key: PanelTab; label: string }[] = [
  { key: "medication", label: "Medication" },
  { key: "monitoring", label: "Monitoring" },
  { key: "notes", label: "Notes" },
  { key: "history", label: "History" },
];

const DOSE_STATUS_META: Record<
  string,
  { label: string; badge: "success" | "warning" | "danger" | "info" | "default"; row: string }
> = {
  taken: { label: "Taken on time", badge: "success", row: "border-l-2 border-l-success" },
  late: { label: "Taken late", badge: "warning", row: "border-l-2 border-l-warning" },
  missed: { label: "Missed", badge: "danger", row: "border-l-2 border-l-danger bg-danger-bg/40" },
  pending: { label: "Awaiting verification", badge: "info", row: "border-l-2 border-l-info" },
};

function fmtTime12(hhmmss: string | null | undefined): string {
  if (!hhmmss) return "—";
  const [hRaw, m] = hhmmss.split(":");
  const h = Number(hRaw);
  if (Number.isNaN(h)) return hhmmss;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m ?? "00"} ${h < 12 ? "AM" : "PM"}`;
}

function fmtTakenAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-text-tertiary shrink-0">{label}</span>
      <span className="text-text-primary text-right">{value || "—"}</span>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border-light bg-bg-subtle/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function DayDetailPanel({
  date,
  doseLogs,
  monitoringEntry,
  recentHistory,
  loadingDoseDetail = false,
  onClose,
}: {
  date: string;
  /** Dose-level logs for this date (from the monitoring API `date` param). */
  doseLogs: DoseLog[];
  monitoringEntry: MonitoringEntry | undefined;
  /** Recent medication history for the patient (History tab). */
  recentHistory: DoseLog[];
  loadingDoseDetail?: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>("medication");

  const history = useMemo(() => {
    // Keep it short: exclude the selected date's own rows — those are in Tab 1.
    return recentHistory.filter((l) => l.scheduled_date !== date).slice(0, 8);
  }, [recentHistory, date]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-[12px] border border-border-light bg-bg-card flex flex-col"
    >
      {/* ── Header: selected date ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {new Date(date + "T00:00:00").toLocaleDateString("en-PH", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-[11px] text-text-tertiary mt-0.5">Daily record detail</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-bg-subtle hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-border-light px-2" role="tablist">
        {PANEL_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
              tab === t.key ? "text-primary-700" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-500" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab body ── */}
      <div className="p-4 space-y-3 overflow-y-auto">
        {/* ═══ TAB 1: MEDICATION ═══ */}
        {tab === "medication" &&
          (loadingDoseDetail ? (
            <p className="text-sm text-text-tertiary py-4 text-center">Loading doses…</p>
          ) : doseLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Pill className="h-5 w-5 text-text-tertiary mb-2" />
              <p className="text-sm text-text-secondary font-medium">No medication record</p>
              <p className="text-xs text-text-tertiary mt-1 max-w-[220px]">
                No doses were scheduled or logged for this date.
              </p>
            </div>
          ) : (
            doseLogs.map((log) => {
              const meta = DOSE_STATUS_META[log.status];
              return (
                <div
                  key={log.id}
                  className={`rounded-[10px] border border-border-light bg-bg-subtle/40 p-3 ${meta?.row ?? ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {log.medication_name}
                        {log.strength ? ` ${log.strength}` : ""}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {[log.dosage, log.dose_quantity].filter(Boolean).join(" · ") || "Dosage not set"}
                      </p>
                    </div>
                    <Badge variant={meta?.badge ?? "default"} size="sm">
                      {meta?.label ?? log.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <LabelValue label="Scheduled time" value={fmtTime12(log.scheduled_time)} />
                    {(log.status === "taken" || log.status === "late" || log.status === "pending") && (
                      <LabelValue label="Taken at" value={fmtTakenAt(log.taken_at)} />
                    )}
                    {log.observed_by_name && (
                      <LabelValue label="Observed by" value={log.observed_by_name} />
                    )}
                    <LabelValue
                      label="Proof"
                      value={
                        log.proof_status === "provided" ? (
                          <span className="inline-flex items-center gap-1.5">
                            {log.proof_url ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={log.proof_url}
                                  alt="Dose proof"
                                  className="h-8 w-8 rounded-[6px] object-cover border border-border-light"
                                />
                                <span className="text-xs text-text-secondary">Photo provided</span>
                              </>
                            ) : (
                              <span className="text-xs text-text-secondary">Photo provided</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-text-tertiary">None</span>
                        )
                      }
                    />
                  </div>
                </div>
              );
            })
          ))}

        {/* ═══ TAB 2: MONITORING ═══ */}
        {tab === "monitoring" &&
          (monitoringEntry ? (
            <div className="space-y-3">
              <PanelSection title="Vitals">
                <LabelValue label="Weight" value={monitoringEntry.weight_kg ? `${monitoringEntry.weight_kg} kg` : "—"} />
                <LabelValue label="Temperature" value={monitoringEntry.temperature_c ? `${monitoringEntry.temperature_c} °C` : "—"} />
                <LabelValue
                  label="Blood Pressure"
                  value={
                    monitoringEntry.blood_pressure_systolic && monitoringEntry.blood_pressure_diastolic
                      ? `${monitoringEntry.blood_pressure_systolic}/${monitoringEntry.blood_pressure_diastolic} mmHg`
                      : "—"
                  }
                />
                <LabelValue label="Heart Rate" value={monitoringEntry.heart_rate_bpm ? `${monitoringEntry.heart_rate_bpm} bpm` : "—"} />
                <LabelValue label="Respiratory Rate" value={monitoringEntry.respiratory_rate ? `${monitoringEntry.respiratory_rate}/min` : "—"} />
                <LabelValue label="O₂ Saturation" value={monitoringEntry.oxygen_saturation ? `${monitoringEntry.oxygen_saturation}%` : "—"} />
              </PanelSection>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-5 w-5 text-text-tertiary mb-2" />
              <p className="text-sm text-text-secondary font-medium">No monitoring entry</p>
              <p className="text-xs text-text-tertiary mt-1 max-w-[240px]">
                No monitoring entry recorded on this date.
              </p>
            </div>
          ))}

        {/* ═══ TAB 3: NOTES ═══ */}
        {tab === "notes" &&
          (doseLogs.some((l) => l.patient_notes || l.plan_medication_notes) ? (
            <div className="space-y-3">
              {doseLogs
                .filter((l) => l.patient_notes || l.plan_medication_notes)
                .map((l) => (
                  <PanelSection key={l.id} title={l.medication_name}>
                    {l.patient_notes && (
                      <div>
                        <p className="text-[11px] text-text-tertiary mb-0.5">Patient note</p>
                        <p className="text-sm text-text-secondary">{l.patient_notes}</p>
                      </div>
                    )}
                    {l.plan_medication_notes && (
                      <div>
                        <p className="text-[11px] text-text-tertiary mb-0.5">Admin note</p>
                        <p className="text-sm text-text-secondary">{l.plan_medication_notes}</p>
                      </div>
                    )}
                  </PanelSection>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <StickyNote className="h-5 w-5 text-text-tertiary mb-2" />
              <p className="text-sm text-text-secondary font-medium">No notes</p>
              <p className="text-xs text-text-tertiary mt-1 max-w-[240px]">
                No patient or admin notes for this date's medication record.
              </p>
            </div>
          ))}

        {/* ═══ TAB 4: HISTORY ═══ */}
        {tab === "history" &&
          (history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-5 w-5 text-text-tertiary mb-2" />
              <p className="text-sm text-text-secondary font-medium">No history yet</p>
              <p className="text-xs text-text-tertiary mt-1 max-w-[240px]">
                Previous medication entries will appear here as doses are logged.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((h) => {
                const meta = DOSE_STATUS_META[h.status];
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2 rounded-[8px] border border-border-light px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {h.medication_name}
                        {h.strength ? ` ${h.strength}` : ""}
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        {h.scheduled_date
                          ? new Date(h.scheduled_date + "T00:00:00").toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                        {h.scheduled_time ? ` · ${fmtTime12(h.scheduled_time)}` : ""}
                      </p>
                    </div>
                    <Badge variant={meta?.badge ?? "default"} size="sm">
                      {meta?.label ?? h.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </motion.div>
  );
}
