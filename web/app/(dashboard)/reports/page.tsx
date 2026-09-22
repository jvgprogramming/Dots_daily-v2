"use client";

/**
 * Reports & Analytics — medication adherence reporting for admins.
 *
 * Read-only aggregation of the live medication logs that patients record
 * from the mobile app (dose confirmations + proof photos). No separate
 * reporting storage — everything comes from the MedicationLog table.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Table } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Camera,
  CheckCircle2,
  Clock,
  ImageOff,
  Pill,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { getMedicationReports } from "@/lib/services/dashboard";
import { getPatientList } from "@/lib/services/patients";
import type {
  PatientSelectOption,
  ReportMedicationLog,
  ReportsData,
} from "@/lib/types";

const SELECT_CLASSES =
  "flex h-10 w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

/** Local-time ISO date (YYYY-MM-DD) — avoids UTC off-by-one issues. */
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function fmtTime(hhmmss: string | null | undefined): string {
  if (!hhmmss) return "";
  const [hRaw, m] = hhmmss.split(":");
  const h = Number(hRaw);
  if (Number.isNaN(h)) return hhmmss;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const amPm = h < 12 ? "AM" : "PM";
  return `${hour12}:${m ?? "00"} ${amPm}`;
}

const STATUS_META: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  taken: { label: "Taken", variant: "success" },
  late: { label: "Late", variant: "warning" },
  missed: { label: "Missed", variant: "danger" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta?.variant ?? "default"} size="sm">
      {meta?.label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

const TrendTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-[10px] border border-border-light bg-bg-card px-4 py-3 shadow-dropdown">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-sm text-text-secondary">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}:{" "}
          <span className="font-medium text-text-primary">
            {entry.name?.includes("%") ? `${entry.value}%` : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [patients, setPatients] = useState<PatientSelectOption[]>([]);
  const [from, setFrom] = useState(() => fmtISO(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => fmtISO(new Date()));
  const [patientId, setPatientId] = useState("");

  const [previewLog, setPreviewLog] = useState<ReportMedicationLog | null>(null);

  const loadReports = useCallback(async () => {
    setError("");
    try {
      const res = await getMedicationReports({
        from: from || undefined,
        to: to || undefined,
        patient_id: patientId ? Number(patientId) : undefined,
      });
      if (res.data) setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, patientId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    getPatientList()
      .then((res) => {
        if (res.data) setPatients(res.data);
      })
      .catch(() => {
        /* filter dropdown is optional — ignore load failures */
      });
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const applyPreset = (days: number) => {
    setFrom(fmtISO(new Date(Date.now() - (days - 1) * 86400000)));
    setTo(fmtISO(new Date()));
  };

  const overview = data?.overview;
  const trend = data?.trend ?? [];
  const patientRows = data?.patients ?? [];
  const recentLogs = data?.recent_logs ?? [];
  const proofUploads = data?.proof_uploads ?? [];

  const pct = (v: number | null | undefined) => Math.max(0, Math.min(100, v ?? 0));
  const fmtPct = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : `${v}%`;

  const hasAnyDose = (overview?.total_doses ?? 0) > 0;

  const summaryCards = [
    {
      title: "Adherence Rate",
      value: fmtPct(overview?.adherence_rate),
      icon: Activity,
      hint: overview ? `${overview.total_doses} doses scheduled` : undefined,
      progress: pct(overview?.adherence_rate),
      progressVariant: "default" as const,
    },
    {
      title: "Taken",
      value: overview?.taken ?? 0,
      icon: CheckCircle2,
      hint: "Confirmed on time",
      progress: overview && overview.total_doses > 0 ? (overview.taken / overview.total_doses) * 100 : 0,
      progressVariant: "success" as const,
    },
    {
      title: "Late",
      value: overview?.late ?? 0,
      icon: Clock,
      hint: "Confirmed after schedule",
      progress: overview && overview.total_doses > 0 ? (overview.late / overview.total_doses) * 100 : 0,
      progressVariant: "warning" as const,
    },
    {
      title: "Missed",
      value: overview?.missed ?? 0,
      icon: XCircle,
      hint: "Not confirmed",
      progress: overview && overview.total_doses > 0 ? (overview.missed / overview.total_doses) * 100 : 0,
      progressVariant: "danger" as const,
    },
    {
      title: "Proof Uploads",
      value: overview?.doses_with_proof ?? 0,
      icon: Camera,
      hint: overview ? `${fmtPct(overview.proof_upload_rate)} of doses` : undefined,
    },
    {
      title: "Patients Logging",
      value: overview?.patients_with_logs ?? 0,
      icon: Users,
      hint: "Active in this range",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-text-primary">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Medication adherence reported from patient dose confirmations in the
            mobile app.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Could not load reports">
          {error}
        </Alert>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4 pt-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5">
            {[7, 30, 90].map((d) => (
              <Button key={d} variant="outline" size="sm" onClick={() => applyPreset(d)}>
                {d}d
              </Button>
            ))}
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              From
            </label>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              To
            </label>
            <Input
              type="date"
              value={to}
              min={from}
              max={fmtISO(new Date())}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="w-64">
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Patient
            </label>
            <select
              className={SELECT_CLASSES}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">All patients</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {data && (
            <p className="ml-auto text-xs text-text-tertiary">
              {fmtDate(overview?.from)} – {fmtDate(overview?.to)} · generated{" "}
              {fmtDateTime(data.generated_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading &&
          summaryCards.map((c) => (
            <div
              key={c.title}
              className="rounded-[16px] border border-border-light bg-bg-card p-5 shadow-card"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-14" />
              <Skeleton className="mt-3 h-3 w-20" />
            </div>
          ))}

        {!loading &&
          summaryCards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-[16px] border border-border-light bg-bg-card p-5 shadow-card"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-text-secondary">{c.title}</p>
                    <p className="text-[26px] font-bold leading-none text-text-primary">
                      {c.value}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-bg-subtle">
                    <Icon className="h-[18px] w-[18px] text-text-tertiary" />
                  </div>
                </div>
                {c.progress !== undefined ? (
                  <Progress
                    value={c.progress}
                    variant={c.progressVariant}
                    size="sm"
                    className="mt-3"
                  />
                ) : (
                  <div className="mt-3" />
                )}
                {c.hint && (
                  <p className="mt-1 text-xs text-text-tertiary">{c.hint}</p>
                )}
              </div>
            );
          })}
      </div>

      {/* ── Adherence trend ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daily Dose Trend</CardTitle>
            <CardDescription>
              Taken, late, and missed doses per day with adherence rate
            </CardDescription>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary-50">
            <Pill className="h-[18px] w-[18px] text-primary-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : !hasAnyDose ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={<Pill className="h-5 w-5" />}
                  title="No medication logs in this range"
                  description="Once patients confirm doses in the mobile app, they appear here automatically."
                />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="doses"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="doses"
                    dataKey="taken"
                    name="Taken"
                    stackId="doses"
                    fill="#16a34a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    yAxisId="doses"
                    dataKey="late"
                    name="Late"
                    stackId="doses"
                    fill="#f59e0b"
                  />
                  <Bar
                    yAxisId="doses"
                    dataKey="missed"
                    name="Missed"
                    stackId="doses"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="rate"
                    name="Adherence %"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Patient adherence breakdown ── */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Adherence</CardTitle>
          <CardDescription>
            Adherence breakdown per patient within the selected range
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table
              columns={[
                {
                  key: "name",
                  header: "Patient",
                  cell: (p) => (
                    <div>
                      <p className="font-medium text-text-primary">{p.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {p.status === "draft" ? "Draft" : `#${p.id}`}
                      </p>
                    </div>
                  ),
                },
                { key: "total_doses", header: "Doses" },
                { key: "taken", header: "Taken" },
                { key: "late", header: "Late" },
                { key: "missed", header: "Missed" },
                {
                  key: "adherence_rate",
                  header: "Adherence",
                  className: "min-w-[160px]",
                  cell: (p) =>
                    p.adherence_rate === null ? (
                      <span className="text-text-tertiary">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={pct(p.adherence_rate)}
                          size="sm"
                          variant={
                            p.adherence_rate >= 90
                              ? "success"
                              : p.adherence_rate >= 80
                              ? "warning"
                              : "danger"
                          }
                          className="w-24"
                        />
                        <span className="text-xs font-medium text-text-secondary">
                          {p.adherence_rate}%
                        </span>
                      </div>
                    ),
                },
                {
                  key: "proof_uploads",
                  header: "Proof",
                  cell: (p) =>
                    p.proof_uploads > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                        <Camera className="h-3.5 w-3.5" />
                        {p.proof_uploads}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    ),
                },
                {
                  key: "last_dose_date",
                  header: "Last Dose",
                  cell: (p) => fmtDate(p.last_dose_date),
                },
              ]}
              data={patientRows}
              keyExtractor={(p) => p.id}
              emptyMessage="No patient medication logs in this range."
            />
          )}
        </CardContent>
      </Card>

      {/* ── Recent medication logs (live feed from mobile) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Medication Logs</CardTitle>
          <CardDescription>
            Latest dose confirmations recorded from the mobile app
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table
              columns={[
                {
                  key: "patient_name",
                  header: "Patient",
                  cell: (l) => (
                    <p className="font-medium text-text-primary">{l.patient_name}</p>
                  ),
                },
                {
                  key: "medication_name",
                  header: "Medication",
                  cell: (l) => l.medication_name ?? "—",
                },
                {
                  key: "scheduled_date",
                  header: "Scheduled",
                  cell: (l) => (
                    <div>
                      <p>{fmtDate(l.scheduled_date)}</p>
                      {l.scheduled_time && (
                        <p className="text-xs text-text-tertiary">
                          {fmtTime(l.scheduled_time)}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (l) => <StatusBadge status={l.status} />,
                },
                {
                  key: "taken_at",
                  header: "Taken At",
                  cell: (l) => fmtDateTime(l.taken_at),
                },
                {
                  key: "dose_quantity",
                  header: "Dose",
                  cell: (l) => l.dose_quantity ?? "—",
                },
                {
                  key: "proof",
                  header: "Proof",
                  cell: (l) =>
                    l.proof_url ? (
                      <button
                        onClick={() => setPreviewLog(l)}
                        className="block overflow-hidden rounded-[8px] border border-border-light transition-opacity hover:opacity-80"
                        title="View proof photo"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={l.proof_url}
                          alt={`Proof for ${l.patient_name}`}
                          className="h-10 w-10 object-cover"
                        />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                        <ImageOff className="h-3.5 w-3.5" />
                        None
                      </span>
                    ),
                },
                {
                  key: "notes",
                  header: "Notes",
                  className: "max-w-[220px]",
                  cell: (l) =>
                    l.notes ? (
                      <span className="line-clamp-2 text-xs text-text-secondary" title={l.notes}>
                        {l.notes}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    ),
                },
              ]}
              data={recentLogs}
              keyExtractor={(l) => l.id}
              emptyMessage="No medication logs recorded in this range yet."
            />
          )}
        </CardContent>
      </Card>

      {/* ── Proof upload gallery ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Proof Uploads</CardTitle>
            <CardDescription>
              Photo evidence attached to dose confirmations
            </CardDescription>
          </div>
          {!loading && proofUploads.length > 0 && (
            <Badge variant="primary" size="sm">
              {proofUploads.length}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : proofUploads.length === 0 ? (
            <EmptyState
              icon={<Camera className="h-5 w-5" />}
              title="No proof uploads in this range"
              description="Dose confirmations that include a proof photo will be shown here."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {proofUploads.map((log) =>
                log.proof_url ? (
                  <button
                    key={log.id}
                    onClick={() => setPreviewLog(log)}
                    className="group overflow-hidden rounded-[12px] border border-border-light bg-bg-subtle text-left transition-shadow hover:shadow-card"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={log.proof_url}
                      alt={`Proof by ${log.patient_name}`}
                      className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    <div className="space-y-1 p-2.5">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {log.patient_name}
                      </p>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-text-tertiary">
                          {fmtDate(log.scheduled_date)}
                        </span>
                        <StatusBadge status={log.status} />
                      </div>
                    </div>
                  </button>
                ) : null
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Proof preview modal ── */}
      <Modal
        open={previewLog !== null}
        onClose={() => setPreviewLog(null)}
        title={previewLog ? `Proof — ${previewLog.patient_name}` : undefined}
        description={
          previewLog
            ? `${previewLog.medication_name ?? "Medication"} · ${fmtDate(
                previewLog.scheduled_date
              )}${previewLog.scheduled_time ? ` · ${fmtTime(previewLog.scheduled_time)}` : ""}`
            : undefined
        }
        size="lg"
      >
        {previewLog && (
          <div className="space-y-4">
            {previewLog.proof_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewLog.proof_url}
                alt={`Proof by ${previewLog.patient_name}`}
                className="max-h-[55vh] w-full rounded-[12px] border border-border-light object-contain bg-bg-subtle"
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-[12px] border border-dashed border-border-light text-sm text-text-tertiary">
                No proof photo available
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={previewLog.status} />
              {previewLog.taken_at && (
                <span className="text-text-secondary">
                  Taken {fmtDateTime(previewLog.taken_at)}
                </span>
              )}
              {previewLog.dose_quantity && (
                <span className="text-text-secondary">
                  · Dose: {previewLog.dose_quantity}
                </span>
              )}
              {previewLog.observed_by_name && (
                <span className="text-text-secondary">
                  · Observed by {previewLog.observed_by_name}
                </span>
              )}
            </div>
            {previewLog.notes && (
              <p className="rounded-[10px] bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
                {previewLog.notes}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
