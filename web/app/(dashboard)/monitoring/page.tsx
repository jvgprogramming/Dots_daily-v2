"use client";

/**
 * Daily Monitoring — admin treatment monitoring dashboard.
 *
 * Patient-centric calendar view of treatment progress: medication adherence
 * by date, daily monitoring entries, timeline from the treatment plan, and
 * risk indicators for non-adherence or schedule problems.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Pill,
  TrendingUp,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Target,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { MonitoringCalendar, DayDetailPanel } from "@/components/features/monitoring/MonitoringCalendar";
import { PatientPicker } from "@/components/features/monitoring/PatientPicker";
import { getPatientMonitoring } from "@/lib/services/monitoring";
import { useClinicSettings } from "@/lib/hooks/useClinicSettings";
import { verifyMedicationLog, unverifyMedicationLog } from "@/lib/services/dashboard";
import type {
  PatientListItem,
  PatientMonitoringData,
  AdherenceDay,
} from "@/lib/types";

const ADHERENCE_FILTERS = [
  { value: "all", label: "All adherence" },
  { value: "taken", label: "Taken" },
  { value: "pending", label: "Pending" },
  { value: "missed", label: "Missed" },
  { value: "late", label: "Late" },
  { value: "not_recorded", label: "Not recorded" },
] as const;

// ─── Date helpers (all local-time ISO YYYY-MM-DD) ───
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string): Date {
  return new Date(s + "T00:00:00");
}
function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - d.getDay());
  return toISO(d);
}
function startOfMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// ─── Risk indicator config ───
const RISK_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default"; icon: React.ElementType }> = {
  on_track: { label: "On track", variant: "success", icon: CheckCircle2 },
  // "{n}" is filled from the risk bands in Settings → Clinical rules.
  watch: { label: "Watch — adherence below {n}%", variant: "warning", icon: AlertTriangle },
  high_risk: { label: "High risk — adherence below {n}%", variant: "danger", icon: AlertTriangle },
  overdue: { label: "Overdue — past expected end date", variant: "danger", icon: AlertTriangle },
  interrupted: { label: "Treatment interrupted", variant: "danger", icon: AlertTriangle },
  discontinued: { label: "Treatment discontinued", variant: "default", icon: AlertTriangle },
};

// ─── Summary card ───
function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "text-text-primary",
    success: "text-success-text",
    warning: "text-warning-text",
    danger: "text-danger-text",
  };
  return (
    <div className="stat-card">
      <div className="stat-card__head">
        <p className="stat-card__label">{label}</p>
        <span className="stat-indicator" data-live="true">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className={`stat-card__value stat-card__value--sm ${tones[tone]}`}>{value}</p>
      {sub && <p className="stat-card__foot">{sub}</p>}
    </div>
  );
}

export default function MonitoringPage() {
  const searchParams = useSearchParams();
  const clinic = useClinicSettings();
  const deepLinkPatientId = searchParams.get("patient");

  // ── Patient selection ──
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    deepLinkPatientId ? Number(deepLinkPatientId) || null : null
  );

  // ── Monitoring data ──
  const [data, setData] = useState<PatientMonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Calendar state ──
  const todayISO = toISO(new Date());
  const [anchorDate, setAnchorDate] = useState(todayISO);
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "taken" | "pending" | "missed" | "late" | "not_recorded">("all");

  // ── Patient picker callbacks (picker loads registered patients itself) ──
  const handleSelectPatient = useCallback((p: PatientListItem) => {
    setSelectedPatientId(p.id);
    setSelectedDate(null);
  }, []);

  // Auto-select the first patient when nothing is selected (no deep link)
  const handleFirstLoad = useCallback((p: PatientListItem) => {
    setSelectedPatientId((cur) => cur ?? p.id);
  }, []);

  // ── Compute visible range from anchor + view ──
  const range = useMemo(() => {
    if (view === "week") {
      const ws = startOfWeek(anchorDate);
      return { start: ws, end: addDays(ws, 6) };
    }
    return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  }, [anchorDate, view]);

  // ── Fetch monitoring data ──
  // `quiet` is what the background poll uses, so new doses land in the calendar
  // without the grid dropping back to a loading state every 30 seconds.
  const fetchMonitoring = useCallback(async (quiet = false) => {
    if (!selectedPatientId) return;
    if (!quiet) setLoading(true);
    setError("");
    try {
      const res = await getPatientMonitoring({
        patient_id: selectedPatientId,
        from: range.start,
        to: range.end,
        date: selectedDate ?? undefined,
      });
      if (res.data) setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load monitoring data");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedPatientId, range.start, range.end, selectedDate]);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

  // Keeps the calendar current while it sits open on a clinic screen.
  useAutoRefresh(() => fetchMonitoring(true));

  // ── Lookup maps for the calendar ──
  const adherenceByDate = useMemo(
    () => new Map((data?.adherence_by_date ?? []).map((d) => [d.date, d])),
    [data]
  );
  const monitoringByDate = useMemo(
    () => new Map((data?.monitoring_entries ?? []).map((m) => [m.recorded_date, m])),
    [data]
  );

  // ── Adherence status filter applies to the calendar grid ──
  const filteredAdherence = useMemo(() => {
    if (statusFilter === "all") return adherenceByDate;
    const filtered = new Map<string, AdherenceDay>();
    adherenceByDate.forEach((day, iso) => {
      const has =
        statusFilter === "not_recorded"
          ? !adherenceByDate.has(iso) || (day.total_doses === 0 && !day.daily_monitoring_recorded)
          : day[statusFilter] > 0;
      // For not_recorded, also include days with no adherence entry at all —
      // handled implicitly since the grid derives status from the map.
      if (statusFilter === "not_recorded" ? day.total_doses > 0 && day.taken === 0 && day.late === 0 : has) {
        filtered.set(iso, day);
      }
    });
    return filtered;
  }, [adherenceByDate, statusFilter]);

  const plan = data?.treatment_plan ?? null;
  const progress = data?.progress ?? null;
  const summary = data?.summary;
  const watchBelow = clinic?.risk_watch_below ?? 90;
  const highBelow = clinic?.risk_high_below ?? 80;
  const riskBase = progress ? RISK_CONFIG[progress.risk] : null;
  const risk = riskBase && progress
    ? {
        ...riskBase,
        label: riskBase.label.replace("{n}", String(progress.risk === "high_risk" ? highBelow : watchBelow)),
      }
    : null;

  const selectedDay = selectedDate ? filteredAdherence.get(selectedDate) ?? adherenceByDate.get(selectedDate) : undefined;
  const selectedMonitoring = selectedDate ? monitoringByDate.get(selectedDate) : undefined;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Daily Monitoring</h1>
          <p className="page-lede">
            Track treatment adherence, progress, and risk for each patient.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchMonitoring()}
          disabled={loading || !selectedPatientId}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <Alert variant="danger" onClose={() => setError("")}>{error}</Alert>}

      {/* ── Patient picker + filters ── */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <PatientPicker
          selectedId={selectedPatientId}
          selectedName={data?.patient?.id === selectedPatientId ? data?.patient?.name : undefined}
          onSelect={handleSelectPatient}
          onFirstLoad={handleFirstLoad}
          onError={setError}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[8px] bg-bg-subtle p-0.5" role="group" aria-label="Calendar view">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-medium rounded-[6px] transition-all duration-150 ${
                  view === v ? "bg-bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {v === "month" ? "Month" : "Week"}
              </button>
            ))}
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Adherence filter"
              className={`h-8 appearance-none rounded-[8px] border pl-8 pr-8 text-xs font-medium outline-none transition-colors ${
                statusFilter === "all"
                  ? "border-border-light bg-bg-card text-text-secondary"
                  : "border-primary-300 bg-primary-100/70 text-primary-900"
              }`}
            >
              {ADHERENCE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      {!selectedPatientId ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No patient selected"
          description="Register a patient first, then select one to view their treatment monitoring."
        />
      ) : loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[12px]" />)}
          </div>
          <Skeleton className="h-80 rounded-[12px]" />
        </div>
      ) : data ? (
        <>
          {/* ── Risk banner ── */}
          {risk && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-3 rounded-[12px] p-4 ${
                risk.variant === "danger" ? "bg-danger-bg" : risk.variant === "warning" ? "bg-warning-bg" : "bg-success-bg"
              }`}
            >
              <risk.icon className={`h-5 w-5 shrink-0 ${risk.variant === "danger" ? "text-danger" : risk.variant === "warning" ? "text-warning-text" : "text-success-text"}`} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${risk.variant === "danger" ? "text-danger-text" : risk.variant === "warning" ? "text-warning-text" : "text-success-text"}`}>
                  {risk.label}
                </p>
                {plan && (
                  <p className={`text-xs mt-0.5 ${risk.variant === "danger" ? "text-danger-text/80" : risk.variant === "warning" ? "text-warning-text/80" : "text-success-text/80"}`}>
                    {plan.plan_name} · {plan.regimen_type ?? "Regimen not set"} · Phase: {plan.phase}
                  </p>
                )}
              </div>
              {progress?.approaching_end && (
                <Badge variant="warning" size="sm">Ends in {progress.days_remaining} days</Badge>
              )}
            </motion.div>
          )}

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={TrendingUp}
              label="Adherence Rate"
              value={summary?.adherence_rate != null ? `${summary.adherence_rate}%` : "—"}
              sub={`${summary?.days_taken ?? 0} of ${summary?.scheduled_days ?? 0} expected days taken${
                (summary?.pending ?? 0) > 0 ? ` · ${summary?.pending ?? 0} awaiting verification` : ""
              }`}
              tone={summary?.adherence_rate != null && summary.adherence_rate < highBelow ? "danger" : summary?.adherence_rate != null && summary.adherence_rate < watchBelow ? "warning" : "success"}
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Missed Doses"
              value={String(summary?.missed ?? 0)}
              sub={`${summary?.late ?? 0} late`}
              tone={(summary?.missed ?? 0) > 0 ? "warning" : "default"}
            />
            <SummaryCard
              icon={Target}
              label="Treatment Progress"
              value={progress ? `${progress.progress_pct}%` : "—"}
              sub={progress ? `Day ${progress.days_elapsed} of ${progress.total_days}` : "No active plan"}
            />
            <SummaryCard
              icon={CalendarDays}
              label="Days Remaining"
              value={progress ? (progress.status === "completed" ? "Done" : String(progress.days_remaining)) : "—"}
              sub={progress ? `Ends ${new Date(progress.expected_end_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : undefined}
              tone={progress?.approaching_end ? "warning" : "default"}
            />
          </div>

          {/* ── Treatment timeline ── */}
          {progress && (
            <div className="matte-surface rounded-[16px] border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Pill className="h-4 w-4 shrink-0 text-text-tertiary" />
                  <p className="text-sm font-semibold text-text-primary">Treatment Timeline</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={progress.status === "active" ? "success" : progress.status === "completed" ? "primary" : "default"} size="sm">
                    {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1)} phase
                  </Badge>
                </div>
              </div>

              {/* Progress bar with start/end labels */}
              <div className="relative pt-1 pb-5">
                <div className="h-3 w-full rounded-full bg-bg-subtle overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.progress_pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      progress.risk === "high_risk" || progress.risk === "overdue" ? "bg-danger" : progress.risk === "watch" ? "bg-warning" : "bg-primary-500"
                    }`}
                  />
                </div>
                <div className="absolute left-0 top-7 text-[11px] text-text-tertiary">
                  {new Date(progress.start_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="absolute right-0 top-7 text-[11px] text-text-tertiary">
                  {progress.actual_end_date
                    ? `Ended ${new Date(progress.actual_end_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`
                    : `Expected ${new Date(progress.expected_end_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`}
                </div>
              </div>

              {/* Plan medications */}
              {plan && plan.medications.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {plan.medications.map((m) => (
                    <span key={m.id} className="text-xs rounded-[6px] bg-bg-subtle px-2 py-1 text-text-secondary">
                      {m.name}{m.dosage ? ` · ${m.dosage}` : ""}{m.frequency ? ` · ${m.frequency}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Calendar + detail panel ── */}
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <MonitoringCalendar
              rangeStart={range.start}
              rangeEnd={range.end}
              view={view}
              onPrev={() => setAnchorDate((d) => (view === "week" ? addDays(d, -7) : startOfMonth(addDays(startOfMonth(d), -1))))}
              onNext={() => setAnchorDate((d) => (view === "week" ? addDays(d, 7) : startOfMonth(addDays(endOfMonth(d), 1))))}
              onToday={() => setAnchorDate(todayISO)}
              plan={plan}
              adherenceByDate={filteredAdherence}
              monitoringByDate={monitoringByDate}
              selectedDate={selectedDate}
              onSelectDate={(iso) => setSelectedDate((cur) => (cur === iso ? null : iso))}
            />
            {selectedDate ? (
              <DayDetailPanel
                date={selectedDate}
                doseLogs={data?.dose_logs ?? []}
                monitoringEntry={selectedMonitoring}
                recentHistory={data?.recent_history ?? []}
                loadingDoseDetail={loading}
                onClose={() => setSelectedDate(null)}
                onToggleVerify={async (log) => {
                  if (log.observed_by_name) {
                    await unverifyMedicationLog(log.id);
                  } else {
                    await verifyMedicationLog(log.id);
                  }
                  await fetchMonitoring(true);
                }}
              />
            ) : (
              <div className="matte-surface flex flex-col items-center justify-center rounded-[16px] border border-dashed p-6 text-center">
                <CalendarDays className="h-5 w-5 text-text-tertiary mb-2" />
                <p className="text-sm text-text-secondary font-medium">Select a date</p>
                <p className="text-xs text-text-tertiary mt-1">
                  Click any day to review its medication doses and monitoring entry.
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
