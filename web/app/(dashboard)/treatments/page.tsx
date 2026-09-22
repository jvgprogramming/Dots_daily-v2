"use client";

/**
 * Treatments hub — the main clinical operations area.
 *
 * Sections: summary cards, follow-up schedule, and treatment records/history.
 * Everything derives from live treatment plans + medication logs + the
 * follow-up reschedule audit. Follow-up schedule and treatment history live
 * here under Treatments (not as separate sidebar pages).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { getTreatments, rescheduleFollowUp } from "@/lib/services/treatments";
import type {
  TreatmentsData,
  TreatmentRecord,
  TreatmentsStatusFilter,
} from "@/lib/types";

const FILTER_CHIPS: { key: TreatmentsStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "due_soon", label: "Due Soon" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "completed", label: "Completed" },
];

const RECORD_STATUS_META: Record<
  string,
  { label: string; variant: "success" | "warning" | "primary" | "default" | "danger" }
> = {
  active: { label: "Active", variant: "success" },
  due_soon: { label: "Due Soon", variant: "warning" },
  rescheduled: { label: "Rescheduled", variant: "primary" },
  completed: { label: "Completed", variant: "default" },
  discontinued: { label: "Discontinued", variant: "danger" },
  interrupted: { label: "Interrupted", variant: "danger" },
};

const FOLLOW_UP_META: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "default" }
> = {
  scheduled: { label: "Scheduled", variant: "default" },
  due: { label: "Due", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
  completed: { label: "Completed", variant: "success" },
  none: { label: "None", variant: "default" },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso: string): number | null {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** Local-time ISO date (YYYY-MM-DD). */
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

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
    <div className="rounded-[12px] border border-border-light bg-bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-text-tertiary" />
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </p>
      </div>
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Reschedule modal ───
function RescheduleModal({
  record,
  onClose,
  onSuccess,
}: {
  record: TreatmentRecord;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const todayISO = fmtISO(new Date());
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const minDate = record.next_follow_up && record.next_follow_up > todayISO
    ? todayISO
    : todayISO;

  const handleSubmit = async () => {
    if (!newDate) {
      setError("Please choose a new follow-up date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await rescheduleFollowUp(record.id, {
        current_date: record.next_follow_up ?? todayISO,
        new_date: newDate,
        reason: reason || undefined,
        notes: notes || undefined,
      });
      if (res.success) {
        onSuccess(`Follow-up for ${record.patient_name} moved to ${fmtDate(newDate)}.`);
      } else {
        setError(res.message || "Failed to reschedule follow-up.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reschedule follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Reschedule Follow-up"
      description={`${record.patient_name} · ${record.plan_name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="rounded-[10px] bg-bg-subtle px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Current follow-up</span>
            <span className="font-medium text-text-primary">
              {fmtDate(record.next_follow_up)}
            </span>
          </div>
          {record.last_reschedule && (
            <div className="flex items-center justify-between mt-1.5 text-xs text-text-tertiary">
              <span>Previously moved from</span>
              <span>
                {fmtDate(record.last_reschedule.original_date)} →{" "}
                {fmtDate(record.last_reschedule.new_date)}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            New follow-up date <span className="text-danger">*</span>
          </label>
          <Input
            type="date"
            value={newDate}
            min={minDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Reason for reschedule
          </label>
          <Input
            placeholder="e.g. Patient unavailable, facility schedule conflict"
            value={reason}
            maxLength={255}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Notes
          </label>
          <textarea
            className="flex min-h-[72px] w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
            placeholder="Optional context for the care team…"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !newDate}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rescheduling…
              </>
            ) : (
              "Reschedule"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function TreatmentsPage() {
  const [data, setData] = useState<TreatmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TreatmentsStatusFilter>("all");
  const [rescheduleTarget, setRescheduleTarget] = useState<TreatmentRecord | null>(null);

  const loadTreatments = useCallback(async () => {
    setError("");
    try {
      const res = await getTreatments({
        search: search || undefined,
        status: statusFilter,
      });
      if (res.data) setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load treatments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  // Debounced search + filter refetch
  useEffect(() => {
    const t = setTimeout(() => {
      setRefreshing(true);
      loadTreatments();
    }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [search, statusFilter, loadTreatments]);

  const summary = data?.summary;

  const followUps = useMemo(
    () => data?.follow_ups ?? [],
    [data]
  );

  const records = data?.records ?? [];

  const handleRescheduleSuccess = (message: string) => {
    setRescheduleTarget(null);
    setToast(message);
    setTimeout(() => setToast(""), 5000);
    setRefreshing(true);
    loadTreatments();
  };

  const pct = (v: number | null | undefined) => Math.max(0, Math.min(100, v ?? 0));

  const recordColumns = [
    {
      key: "patient_name",
      header: "Patient",
      cell: (r: TreatmentRecord) => (
        <div>
          <p className="font-medium text-text-primary">{r.patient_name}</p>
          <p className="text-xs text-text-tertiary">
            {r.plan_name}
            {r.regimen_type ? ` · ${r.regimen_type}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "phase",
      header: "Phase",
      cell: (r: TreatmentRecord) => (
        <Badge variant="outline" size="sm" className="capitalize">
          {r.phase}
        </Badge>
      ),
    },
    {
      key: "next_follow_up",
      header: "Next Follow-up",
      cell: (r: TreatmentRecord) => {
        if (!r.next_follow_up) {
          return <span className="text-text-tertiary">—</span>;
        }
        const meta = FOLLOW_UP_META[r.next_follow_up_status] ?? FOLLOW_UP_META.none;
        const d = daysUntil(r.next_follow_up);
        return (
          <div className="flex flex-col gap-1">
            <span>{fmtDate(r.next_follow_up)}</span>
            <div className="flex items-center gap-1.5">
              <Badge variant={meta.variant} size="sm">
                {meta.label}
              </Badge>
              {d !== null && r.next_follow_up_status !== "overdue" && d >= 0 && (
                <span className="text-[11px] text-text-tertiary">
                  in {d} {d === 1 ? "day" : "days"}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (r: TreatmentRecord) => {
        const meta = RECORD_STATUS_META[r.record_status] ?? RECORD_STATUS_META.active;
        return <Badge variant={meta.variant} size="sm">{meta.label}</Badge>;
      },
    },
    {
      key: "adherence",
      header: "Adherence",
      className: "min-w-[150px]",
      cell: (r: TreatmentRecord) =>
        r.adherence.rate === null ? (
          <span className="text-text-tertiary">No logs</span>
        ) : (
          <div className="flex items-center gap-2">
            <Progress
              value={pct(r.adherence.rate)}
              size="sm"
              variant={
                r.adherence.rate >= 90 ? "success" : r.adherence.rate >= 80 ? "warning" : "danger"
              }
              className="w-20"
            />
            <span className="text-xs font-medium text-text-secondary">
              {r.adherence.rate}%
            </span>
          </div>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (r: TreatmentRecord) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.href = `/monitoring?patient=${r.patient_id}`;
            }}
          >
            View
          </Button>
          {r.status === "active" && r.next_follow_up && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleTarget(r)}
            >
              Reschedule
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
            Treatments
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Treatment records, follow-up schedule, and adherence across all
            patients.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRefreshing(true);
            loadTreatments();
          }}
          disabled={refreshing || loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <Alert variant="danger" onClose={() => setError("")}>{error}</Alert>}
      {toast && (
        <Alert variant="success" onClose={() => setToast("")}>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </span>
        </Alert>
      )}

      {/* ── Search + filter chips ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search patients by name…"
            className="pl-9 h-10 rounded-[8px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setStatusFilter(chip.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 ${
                statusFilter === chip.key
                  ? "bg-primary-500 text-white"
                  : "bg-bg-subtle text-text-secondary hover:bg-border-light"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[12px]" />
          ))
        ) : (
          <>
            <SummaryCard
              icon={ClipboardList}
              label="Active Treatment Plans"
              value={String(summary?.active_plans ?? 0)}
              sub={`${summary?.total_records ?? 0} total records`}
            />
            <SummaryCard
              icon={CalendarClock}
              label="Due Follow-ups"
              value={String(summary?.due_follow_ups ?? 0)}
              sub={
                (summary?.overdue_follow_ups ?? 0) > 0
                  ? `${summary?.overdue_follow_ups} overdue`
                  : "Nothing overdue"
              }
              tone={
                (summary?.overdue_follow_ups ?? 0) > 0
                  ? "danger"
                  : (summary?.due_follow_ups ?? 0) > 0
                  ? "warning"
                  : "success"
              }
            />
            <SummaryCard
              icon={CalendarDays}
              label="Rescheduled Cases"
              value={String(summary?.rescheduled_cases ?? 0)}
              sub="Follow-ups moved"
            />
            <SummaryCard
              icon={Activity}
              label="Adherence Rate"
              value={summary?.adherence_rate != null ? `${summary.adherence_rate}%` : "—"}
              sub="All treatment plans"
              tone={
                summary?.adherence_rate != null && summary.adherence_rate < 80
                  ? "danger"
                  : summary?.adherence_rate != null && summary.adherence_rate < 90
                  ? "warning"
                  : "success"
              }
            />
          </>
        )}
      </div>

      {/* ── Follow-up Schedule ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Follow-up Schedule</h2>
          {followUps.length > 0 && (
            <Badge variant="primary" size="sm">
              {followUps.length} upcoming
            </Badge>
          )}
        </div>
        {loading && !data ? (
          <Skeleton className="h-40 rounded-[12px]" />
        ) : followUps.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="No upcoming follow-ups"
            description="Active treatment plans with a monthly follow-up anchor will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {followUps.map((f) => {
              const meta = FOLLOW_UP_META[f.next_follow_up_status] ?? FOLLOW_UP_META.none;
              const d = f.next_follow_up ? daysUntil(f.next_follow_up) : null;
              return (
                <div
                  key={f.id}
                  className="rounded-[12px] border border-border-light bg-bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {f.patient_name}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {f.plan_name}
                      </p>
                    </div>
                    <Badge variant={meta.variant} size="sm">
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <CalendarDays className="h-4 w-4 text-text-tertiary" />
                      {fmtDate(f.next_follow_up)}
                    </div>
                    {d !== null && (
                      <span className="text-xs text-text-tertiary">
                        {d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? "Today" : `in ${d} days`}
                      </span>
                    )}
                  </div>
                  {f.last_reschedule && (
                    <p className="mt-2 rounded-[8px] bg-bg-subtle px-2.5 py-1.5 text-[11px] text-text-tertiary">
                      Rescheduled from {fmtDate(f.last_reschedule.original_date)}
                      {f.last_reschedule.reason ? ` — ${f.last_reschedule.reason}` : ""}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setRescheduleTarget(f)}>
                      Reschedule
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Treatment Records / History ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Treatment Records
          </h2>
          {records.length > 0 && (
            <span className="text-xs text-text-tertiary">
              {records.length} {records.length === 1 ? "record" : "records"}
              {statusFilter !== "all" ? ` · ${FILTER_CHIPS.find((c) => c.key === statusFilter)?.label}` : ""}
            </span>
          )}
        </div>
        {loading && !data ? (
          <Skeleton className="h-64 rounded-[12px]" />
        ) : (
          <Table
            columns={recordColumns}
            data={records}
            keyExtractor={(r) => r.id}
            emptyMessage={
              search
                ? `No treatment records match "${search}".`
                : statusFilter === "all"
                ? "No treatment records yet — register a patient with a treatment plan."
                : `No ${FILTER_CHIPS.find((c) => c.key === statusFilter)?.label.toLowerCase()} records.`
            }
          />
        )}
      </section>

      {/* ── Reschedule modal ── */}
      {rescheduleTarget && (
        <RescheduleModal
          record={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </div>
  );
}
