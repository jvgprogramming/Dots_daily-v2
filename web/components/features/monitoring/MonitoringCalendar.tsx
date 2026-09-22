"use client";

/**
 * Monitoring Calendar — patient-centric treatment calendar.
 *
 * Month/week grid where each day shows medication adherence status
 * (taken / missed / late / not recorded) plus a marker when a daily
 * monitoring entry exists. Clicking a day opens the detail panel with
 * dose-level data and monitoring notes.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Activity, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  AdherenceDay,
  MonitoringEntry,
  MonitoringTreatmentPlan,
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

// ─── Day detail panel ───
export function DayDetailPanel({
  date,
  adherenceDay,
  monitoringEntry,
  plan,
  onClose,
}: {
  date: string;
  adherenceDay: AdherenceDay | undefined;
  monitoringEntry: MonitoringEntry | undefined;
  plan: MonitoringTreatmentPlan | null;
  onClose: () => void;
}) {
  const status = dayStatus(adherenceDay);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-[12px] border border-border-light bg-bg-card"
    >
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
          <Badge variant={status === "taken" ? "success" : status === "missed" ? "danger" : status === "pending" ? "info" : status === "late" ? "warning" : "default"} size="sm">
            {STATUS_LABELS[status]}
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-bg-subtle hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Medication doses */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Pill className="h-3.5 w-3.5 text-text-tertiary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">Medication</p>
          </div>
          {adherenceDay ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Doses scheduled</span>
                <span className="text-text-primary">{adherenceDay.total_doses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Taken on time</span>
                <span className="text-success-text">{adherenceDay.taken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Taken late</span>
                <span className="text-warning-text">{adherenceDay.late}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Missed</span>
                <span className="text-danger-text">{adherenceDay.missed}</span>
              </div>
              {adherenceDay.pending > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Awaiting verification</span>
                  <span className="text-info-text">{adherenceDay.pending}</span>
                </div>
              )}
              {plan && plan.medications.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border-light/60">
                  <p className="text-[11px] text-text-tertiary mb-1">Regimen</p>
                  {plan.medications.map((m) => (
                    <p key={m.id} className="text-xs text-text-secondary">
                      {m.name}
                      {m.dosage ? ` · ${m.dosage}` : ""}
                      {m.preferred_time ? ` · ${m.preferred_time}` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">No doses scheduled or recorded on this date.</p>
          )}
        </div>

        {/* Daily monitoring */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="h-3.5 w-3.5 text-text-tertiary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">Daily Monitoring</p>
          </div>
          {monitoringEntry ? (
            <div className="space-y-1.5 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-text-tertiary">Weight</span>
                <span className="text-text-primary">{monitoringEntry.weight_kg ? `${monitoringEntry.weight_kg} kg` : "—"}</span>
                <span className="text-text-tertiary">Temperature</span>
                <span className="text-text-primary">{monitoringEntry.temperature_c ? `${monitoringEntry.temperature_c} °C` : "—"}</span>
                <span className="text-text-tertiary">Blood Pressure</span>
                <span className="text-text-primary">
                  {monitoringEntry.blood_pressure_systolic && monitoringEntry.blood_pressure_diastolic
                    ? `${monitoringEntry.blood_pressure_systolic}/${monitoringEntry.blood_pressure_diastolic}`
                    : "—"}
                </span>
                <span className="text-text-tertiary">Heart Rate</span>
                <span className="text-text-primary">{monitoringEntry.heart_rate_bpm ? `${monitoringEntry.heart_rate_bpm} bpm` : "—"}</span>
                <span className="text-text-tertiary">O₂ Saturation</span>
                <span className="text-text-primary">{monitoringEntry.oxygen_saturation ? `${monitoringEntry.oxygen_saturation}%` : "—"}</span>
              </div>
              {monitoringEntry.notes && (
                <div className="pt-2 mt-2 border-t border-border-light/60">
                  <p className="text-[11px] text-text-tertiary mb-1">Notes</p>
                  <p className="text-xs text-text-secondary">{monitoringEntry.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">No monitoring entry recorded on this date.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
