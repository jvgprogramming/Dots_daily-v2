"use client";

/**
 * Reports & Analytics — medication adherence reporting for admins.
 *
 * Two tabs:
 *  - Adherence: read-only aggregation of the live medication logs patients
 *    record from the mobile app. Everything comes from the MedicationLog table.
 *  - Video-Observed Therapy: the nurse's proof review queue (VotSection).
 *
 * `?tab=vot&submission=ID` (the link in a "new proof" notification) opens the
 * VOT tab with that submission's review already showing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VotSection } from "@/components/features/reports/vot/VotSection";
import { VotDoseBadge } from "@/components/features/reports/vot/VotStatusBadge";
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
  CalendarX2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  ImageOff,
  Loader2,
  Pill,
  PlayCircle,
  RefreshCw,
  Search,
  Users,
  X,
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

const STATUS_META: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  taken: { label: "Taken", variant: "success" },
  late: { label: "Late", variant: "warning" },
  missed: { label: "Missed", variant: "danger" },
  rescheduled: { label: "Rescheduled", variant: "default" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta?.variant ?? "default"} size="sm">
      {meta?.label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

type AdherenceQuickFilter = "all" | "taken" | "late" | "missed" | "unrecorded";

const ADHERENCE_FILTERS: { key: AdherenceQuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "taken", label: "Taken" },
  { key: "late", label: "Late" },
  { key: "missed", label: "Missed" },
  { key: "unrecorded", label: "Unrecorded" },
];

// ─── Searchable patient selector (combobox, live server search) ───
const SEARCH_DEBOUNCE_MS = 250;

function PatientSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSelectOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Remember the chosen patient so its label survives later searches; ignored
  // once the value is cleared from outside.
  const [chosen, setSelected] = useState<PatientSelectOption | null>(null);
  const selected = chosen && String(chosen.id) === value ? chosen : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // Debounced live search — only the newest response is applied.
  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    const t = setTimeout(() => {
      setSearching(true);
      getPatientList(query.trim() || undefined)
        .then((res) => {
          if (id !== requestId.current) return;
          setResults(res.data ?? []);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        })
        .finally(() => {
          if (id === requestId.current) setSearching(false);
        });
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const choose = (p: PatientSelectOption | null) => {
    setSelected(p);
    onChange(p ? String(p.id) : "");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(activeIndex >= 0 ? results[activeIndex] ?? null : null);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Patient</label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
      >
        <span className={selected ? "truncate" : "text-text-tertiary"}>
          {selected
            ? `${selected.name}${selected.health_id_number ? ` · ${selected.health_id_number}` : ""}`
            : value
              ? `Patient #${value}`
              : "All patients"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full min-w-[280px] rounded-[10px] border border-border-light bg-bg-card shadow-dropdown"
          onKeyDown={onKeyDown}
        >
          <div className="relative p-2 border-b border-border-light">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <input
              autoFocus
              className="h-8 w-full rounded-[6px] bg-bg-subtle pl-8 pr-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              placeholder="Search name, email, health ID or #…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary">
              {searching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="hover:text-text-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </span>
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {!query && (
              <button
                type="button"
                onClick={() => choose(null)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-subtle ${
                  !value ? "text-primary-700 font-medium" : "text-text-primary"
                }`}
              >
                <Users className="h-4 w-4 text-text-tertiary" />
                All patients
                {!value && <Check className="ml-auto h-4 w-4 text-primary-600" />}
              </button>
            )}
            {results.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={value === String(p.id)}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                  i === activeIndex ? "bg-bg-subtle" : "hover:bg-bg-subtle"
                } ${value === String(p.id) ? "text-primary-700 font-medium" : "text-text-primary"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  {(p.health_id_number || p.email) && (
                    <span className="block truncate text-[11px] text-text-tertiary">
                      {[p.health_id_number, p.email].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-text-tertiary">#{p.id}</span>
              </button>
            ))}
            {!searching && results.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-text-tertiary">
                {query ? <>No patients match “{query}”.</> : "No patients yet."}
              </p>
            )}
            {results.length >= 50 && (
              <p className="border-t border-border-light px-3 py-2 text-[11px] text-text-tertiary">
                Showing the first 50 — keep typing to narrow down.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
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
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") === "vot" ? "vot" : "adherence";
  const urlSubmission = Number(searchParams.get("submission")) || null;
  const [activeTab, setActiveTab] = useState(urlTab);

  // A notification link can land here while the page is already open: follow
  // the URL when it changes. (Adjusting state during render, React's
  // recommended alternative to syncing it in an effect.)
  const urlKey = `${urlTab}:${urlSubmission ?? ""}`;
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  if (seenUrlKey !== urlKey) {
    setSeenUrlKey(urlKey);
    setActiveTab(urlTab);
  }

  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [from, setFrom] = useState(() => fmtISO(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => fmtISO(new Date()));
  const [patientId, setPatientId] = useState("");
  const [adherenceFilter, setAdherenceFilter] = useState<AdherenceQuickFilter>("all");

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

  // Dose confirmations arriving from patients show up without a manual refresh.
  useAutoRefresh(loadReports);

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
  const rescheduledFollowUps = data?.rescheduled_follow_ups ?? [];

  // ── Adherence quick filters (client-side over loaded report data) ──
  const filteredPatientRows = useMemo(() => {
    if (adherenceFilter === "all") return patientRows;
    if (adherenceFilter === "unrecorded") {
      return patientRows.filter((p) => p.total_doses === 0 || (p.adherence_rate !== null && p.adherence_rate < 50));
    }
    return patientRows.filter((p) => p[adherenceFilter] > 0);
  }, [patientRows, adherenceFilter]);

  const filteredRecentLogs = useMemo(() => {
    if (adherenceFilter === "all" || adherenceFilter === "unrecorded") return recentLogs;
    return recentLogs.filter((l) => l.status === adherenceFilter);
  }, [recentLogs, adherenceFilter]);

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
      title: "Unrecorded Days",
      value: overview?.unrecorded_days ?? 0,
      icon: CalendarX2,
      hint: "Treatment days with no log",
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
          <h1 className="page-title">
            Reports & Analytics
          </h1>
          <p className="page-lede">
            Medication adherence reported from patient dose confirmations in the
            mobile app.
          </p>
        </div>
        {activeTab === "adherence" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>

      <Tabs defaultValue={urlTab} value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="adherence">Adherence</TabsTrigger>
          <TabsTrigger value="vot">Video-Observed Therapy</TabsTrigger>
        </TabsList>

        <TabsContent value="vot">
          <VotSection initialSubmissionId={urlTab === "vot" ? urlSubmission : null} />
        </TabsContent>

        <TabsContent value="adherence" className="space-y-8">
      {error && (
        <Alert variant="danger" title="Could not load reports">
          {error}
        </Alert>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[auto_minmax(150px,1fr)_minmax(150px,1fr)_minmax(240px,1.6fr)]">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-text-secondary">Quick range</span>
              <div className="flex h-10 items-center gap-1.5">
                {[7, 30, 90].map((d) => (
                  <Button key={d} variant="outline" size="sm" onClick={() => applyPreset(d)}>
                    {d}d
                  </Button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <label htmlFor="report-from" className="mb-1.5 block text-xs font-medium text-text-secondary">
                From
              </label>
              <Input id="report-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="min-w-0">
              <label htmlFor="report-to" className="mb-1.5 block text-xs font-medium text-text-secondary">
                To
              </label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from}
                max={fmtISO(new Date())}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="min-w-0 sm:col-span-2 xl:col-span-1">
              <PatientSelector value={patientId} onChange={setPatientId} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-text-secondary">Show:</span>
              {ADHERENCE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setAdherenceFilter(f.key)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-150 ${
                    adherenceFilter === f.key
                      ? "bg-brand-action text-white"
                      : "bg-bg-subtle text-text-secondary hover:bg-border-light"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {data && (
              <p className="text-xs text-text-tertiary">
                {fmtDate(overview?.from)} – {fmtDate(overview?.to)} · generated{" "}
                {fmtDateTime(data.generated_at)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {loading &&
          summaryCards.map((c) => (
            <div key={c.title} className="stat-card">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-14" />
              <Skeleton className="mt-3 h-3 w-20" />
            </div>
          ))}

        {!loading &&
          summaryCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="stat-card">
                <div className="stat-card__head">
                  <p className="stat-card__label">{c.title}</p>
                  <span className="stat-indicator" data-live="true">
                    <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                  </span>
                </div>
                <p className="stat-card__value stat-card__value--sm text-text-primary">
                  {c.value}
                </p>
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
                  <p className="stat-card__foot">{c.hint}</p>
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
                  <CartesianGrid strokeDasharray="2 5" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="doses"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-secondary)" }} />
                  <Bar
                    yAxisId="doses"
                    dataKey="taken"
                    name="Taken"
                    stackId="doses"
                    fill="var(--color-primary-500)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    yAxisId="doses"
                    dataKey="late"
                    name="Late"
                    stackId="doses"
                    fill="var(--color-warning)"
                  />
                  <Bar
                    yAxisId="doses"
                    dataKey="missed"
                    name="Missed"
                    stackId="doses"
                    fill="var(--color-danger)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="rate"
                    name="Adherence %"
                    stroke="var(--color-primary-900)"
                    strokeWidth={1.75}
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
              data={filteredPatientRows}
              keyExtractor={(p) => p.id}
              emptyMessage={
                adherenceFilter === "all"
                  ? "No patient medication logs in this range."
                  : `No patients with ${ADHERENCE_FILTERS.find((f) => f.key === adherenceFilter)?.label.toLowerCase()} doses in this range.`
              }
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
            {adherenceFilter !== "all" && adherenceFilter !== "unrecorded"
              ? ` · filtered: ${adherenceFilter}`
              : ""}
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
                  key: "review",
                  header: "Review",
                  // VOT doses carry their proof-review state; decisions are made
                  // in the Video-Observed Therapy tab. Other doses are simply logged.
                  cell: (l) =>
                    l.verification_status ? (
                      <VotDoseBadge status={l.verification_status} />
                    ) : (
                      <Badge variant={l.verified ? "success" : "default"} size="sm">
                        <Check className="h-3 w-3" />
                        {l.verified ? "Verified" : "Logged"}
                      </Badge>
                    ),
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
                    l.has_video ? (
                      <button
                        onClick={() => setPreviewLog(l)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-border-light bg-bg-subtle text-primary transition-opacity hover:opacity-80"
                        title="Play proof video"
                      >
                        <PlayCircle className="h-5 w-5" />
                      </button>
                    ) : l.proof_url ? (
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
              data={filteredRecentLogs}
              keyExtractor={(l) => l.id}
              emptyMessage={
                adherenceFilter === "unrecorded"
                  ? "Unrecorded days are treatment days with no log at all — check the summary card."
                  : adherenceFilter === "all"
                  ? "No medication logs recorded in this range yet."
                  : `No ${adherenceFilter} doses in the recent feed for this range.`
              }
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
              Photo and video evidence attached to dose confirmations
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
              {proofUploads.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setPreviewLog(log)}
                  className="matte-surface group overflow-hidden rounded-[16px] border text-left transition-shadow hover:shadow-card-hover"
                >
                  <div className="relative h-28 w-full">
                    {log.proof_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={log.proof_url}
                        alt={`Proof by ${log.patient_name}`}
                        className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center bg-bg-subtle text-primary">
                        <PlayCircle className="h-8 w-8" />
                      </div>
                    )}
                    {log.has_video && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                        <PlayCircle className="h-3 w-3" />
                        Video
                      </span>
                    )}
                    {log.verification_status && (
                      <span className="absolute right-2 top-2">
                        <VotDoseBadge status={log.verification_status} />
                      </span>
                    )}
                  </div>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Rescheduled follow-ups ── */}
      <Card>
        <CardHeader>
          <CardTitle>Rescheduled Follow-ups</CardTitle>
          <CardDescription>
            Follow-up visits moved to a new date — still visible in reporting
            history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rescheduledFollowUps.length === 0 ? (
            <EmptyState
              icon={<CalendarX2 className="h-5 w-5" />}
              title="No rescheduled follow-ups"
              description="Follow-ups rescheduled from the Treatments hub will appear here."
            />
          ) : (
            <Table
              columns={[
                {
                  key: "patient_name",
                  header: "Patient",
                  cell: (r) => (
                    <div>
                      <p className="font-medium text-text-primary">{r.patient_name}</p>
                      <p className="text-xs text-text-tertiary">{r.plan_name ?? "Treatment plan"}</p>
                    </div>
                  ),
                },
                {
                  key: "original_date",
                  header: "Original Date",
                  cell: (r) => (
                    <span className="text-text-secondary line-through decoration-text-tertiary/60">
                      {fmtDate(r.original_date)}
                    </span>
                  ),
                },
                {
                  key: "new_date",
                  header: "New Date",
                  cell: (r) => (
                    <span className="font-medium text-text-primary">{fmtDate(r.new_date)}</span>
                  ),
                },
                {
                  key: "rescheduled_at",
                  header: "Rescheduled On",
                  cell: (r) => fmtDate(r.rescheduled_at),
                },
                {
                  key: "reason",
                  header: "Reason",
                  className: "max-w-[220px]",
                  cell: (r) =>
                    r.reason ? (
                      <span className="line-clamp-2 text-xs text-text-secondary" title={r.reason}>
                        {r.reason}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    ),
                },
                {
                  key: "rescheduled_by_name",
                  header: "By",
                  cell: (r) => r.rescheduled_by_name ?? "—",
                },
              ]}
              data={rescheduledFollowUps}
              keyExtractor={(r) => r.id}
            />
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

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
            {previewLog.proof_video_url ? (
              <video
                key={previewLog.proof_video_url}
                src={previewLog.proof_video_url}
                controls
                playsInline
                className="max-h-[55vh] w-full rounded-[12px] border border-border-light bg-black object-contain"
              />
            ) : previewLog.proof_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewLog.proof_url}
                alt={`Proof by ${previewLog.patient_name}`}
                className="max-h-[55vh] w-full rounded-[12px] border border-border-light object-contain bg-bg-subtle"
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-[12px] border border-dashed border-border-light text-sm text-text-tertiary">
                No proof uploaded
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={previewLog.status} />
              {previewLog.verification_status && (
                <VotDoseBadge status={previewLog.verification_status} />
              )}
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
            </div>

            {previewLog.notes && (
              <p className="rounded-[10px] bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
                {previewLog.notes}
              </p>
            )}

            {previewLog.verification_status && (
              <p className="rounded-[10px] border border-border-light px-4 py-3 text-sm text-text-secondary">
                This is a video-observed therapy dose. Verify or reject its proof in the{" "}
                <button
                  type="button"
                  className="font-medium text-primary-700 hover:underline"
                  onClick={() => {
                    setPreviewLog(null);
                    setActiveTab("vot");
                  }}
                >
                  Video-Observed Therapy
                </button>{" "}
                tab.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
