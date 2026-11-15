"use client";

import { useEffect, useState } from "react";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Users,
  Pill,
  Activity,
  AlertTriangle,
  Package,
  TrendingUp,
  ArrowUpRight,
  HeartPulse,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getDashboardStats } from "@/lib/services/dashboard";
import type {
  DashboardStat,
  DashboardStatsData,
  DashboardRecentPatient,
  DashboardDistributionItem,
} from "@/lib/types";

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string | number;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="min-w-[140px] rounded-[10px] border border-border-light bg-bg-card px-3 py-2.5 shadow-dropdown">
        {label !== undefined && label !== "" && (
          <p className="text-[12px] font-semibold text-text-primary">{label}</p>
        )}
        {payload.map((entry, i: number) => (
          <p key={i} className="mt-1 flex items-baseline gap-3 text-[12px] text-text-secondary">
            {entry.name}
            <span className="ml-auto font-semibold tabular-nums text-text-primary">
              {entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Stat icon mapping (matches backend stat order) ───
const STAT_ICONS = [Users, Pill, Activity, AlertTriangle, Package];

// Phase colours are held to the brand palette regardless of backend classes.
const PHASE_DOT: Record<string, string> = {
  Intensive: "bg-primary-900",
  Continuation: "bg-primary-300",
  Completed: "bg-primary-500",
  Interrupted: "bg-danger",
};
const PHASE_FILL: Record<string, string> = {
  Intensive: "var(--color-primary-900)",
  Continuation: "var(--color-primary-300)",
  Completed: "var(--color-primary-500)",
  Interrupted: "var(--color-danger)",
};

/** Two-letter initials for the patient list tile. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // `quiet` is what the background poll uses: it updates the numbers in place
  // rather than flashing the loading skeleton every 30 seconds.
  const loadStats = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const res = await getDashboardStats();
      if (res.data) setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // A dose logged on a patient's phone shows up here without anyone refreshing.
  useAutoRefresh(() => loadStats(true));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  // ── Derived view data (fall back to empty shapes while loading) ──
  const stats: DashboardStat[] = data?.stats ?? [];
  const adherenceData = data?.adherence_trend ?? [];
  const patientActivity = data?.patient_activity ?? [];
  const treatmentDistribution: DashboardDistributionItem[] =
    data?.treatment_distribution ?? [];
  const recentPatients: DashboardRecentPatient[] = data?.recent_patients ?? [];
  const overview = data?.overview;

  const pct = (v: number | null | undefined) => Math.max(0, Math.min(100, v ?? 0));
  const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);

  const noTreatments = treatmentDistribution.every((t) => t.count === 0);

  const trendColors: Record<string, string> = {
    up: "text-primary-600",
    down: "text-danger",
    neutral: "text-text-secondary",
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-lede">
            Overview of the tuberculosis treatment monitoring system.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Could not load dashboard">
          {error}
        </Alert>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-5 h-7 w-16" />
              <Skeleton className="mt-4 h-3 w-24" />
            </div>
          ))}

        {!loading &&
          stats.map((stat, i) => {
            const Icon = STAT_ICONS[i] ?? Activity;
            return (
              <div key={stat.title} className="stat-card">
                <div className="stat-card__head">
                  <p className="stat-card__label">{stat.title}</p>
                  <span className="stat-indicator" data-live="true">
                    <Icon strokeWidth={1.9} />
                  </span>
                </div>
                <p className="stat-card__value">{stat.value}</p>
                <div className="mt-3 flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${trendColors[stat.trend]}`}
                  >
                    {stat.trend === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
                    {stat.change}
                  </span>
                </div>
                {stat.change_note && (
                  <p className="mt-1 text-[11.5px] leading-snug text-text-secondary">
                    {stat.change_note}
                  </p>
                )}
              </div>
            );
          })}
      </div>

      {/* ── Charts Row: adherence is the lead panel ── */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        <Card className="border-transparent bg-brand-action text-white shadow-elevated lg:col-span-3">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-[16px] text-white">Adherence Rate</CardTitle>
                <CardDescription className="text-white/70">
                  Monthly medication adherence trend
                </CardDescription>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 ring-1 ring-inset ring-white/15">
                <HeartPulse className="h-[18px] w-[18px] text-white" strokeWidth={1.9} />
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] sm:h-[290px]">
              {loading ? (
                <Skeleton className="h-full w-full bg-white/10" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={adherenceData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgb(255 255 255 / 0.12)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      tick={{ fill: "rgb(255 255 255 / 0.72)", fontSize: 11.5 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={6}
                      tick={{ fill: "rgb(255 255 255 / 0.72)", fontSize: 11.5 }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: "rgb(255 255 255 / 0.35)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      name="Adherence"
                      stroke="#ffffff"
                      strokeWidth={2.25}
                      fill="url(#adherenceGradient)"
                      activeDot={{ r: 4.5, fill: "#ffffff", stroke: "var(--color-brand-action)", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Treatment Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Treatment Phases</CardTitle>
            <CardDescription>Distribution by DOTS phase</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center gap-5">
                <Skeleton className="h-[150px] w-[150px] rounded-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : noTreatments ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Activity className="h-6 w-6 text-text-muted" strokeWidth={1.6} />
                <p className="text-[13px] text-text-secondary">No treatment data yet</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
                <div className="h-[160px] w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={treatmentDistribution}
                        dataKey="count"
                        nameKey="phase"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={2}
                        stroke="var(--color-bg-card)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {treatmentDistribution.map((item) => (
                          <Cell
                            key={item.phase}
                            fill={PHASE_FILL[item.phase] ?? "var(--color-primary-400)"}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="w-full flex-1 divide-y divide-border-light">
                  {treatmentDistribution.map((item) => (
                    <li
                      key={item.phase}
                      className="flex items-center gap-2.5 py-2.5 text-[13px] first:pt-0 last:pb-0"
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${
                          PHASE_DOT[item.phase] ?? item.color
                        }`}
                      />
                      <span className="font-medium text-text-primary">{item.phase}</span>
                      <span className="ml-auto font-semibold tabular-nums text-text-primary">
                        {item.count}
                      </span>
                      <span className="w-11 text-right text-[12px] tabular-nums text-text-secondary">
                        {item.percentage}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Activity & Recent Patients Row ── */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        {/* Patient Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Patient Activity</CardTitle>
                <CardDescription>New patients and follow-ups this week</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-primary-900" />
                  New Patients
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-primary-300" />
                  Follow-ups
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={patientActivity}
                    barGap={4}
                    barCategoryGap="30%"
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--color-border-light)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 11.5 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={6}
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 11.5 }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "var(--color-chart-cursor)" }}
                    />
                    <Bar
                      dataKey="new"
                      name="New Patients"
                      fill="var(--color-primary-900)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={20}
                    />
                    <Bar
                      dataKey="followups"
                      name="Follow-ups"
                      fill="var(--color-primary-300)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Patients List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Patients</CardTitle>
            <CardDescription>Latest patient registrations</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-3 sm:px-0 sm:pb-3">
            {loading ? (
              <div className="space-y-3 px-5 sm:px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Users className="h-6 w-6 text-text-muted" strokeWidth={1.6} />
                <p className="text-[13px] text-text-secondary">No recent registrations</p>
              </div>
            ) : (
              <ul>
                {recentPatients.map((patient) => (
                  <li
                    key={patient.id}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-bg-subtle sm:px-6"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[12px] font-semibold text-primary-800">
                      {initials(patient.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">
                        {patient.name}
                      </p>
                      <p className="mt-1 text-[11.5px] leading-tight text-text-secondary">
                        {patient.date ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant={patient.status === "draft" ? "warning" : "outline"}
                      size="sm"
                    >
                      {patient.status === "draft" ? "Draft" : (patient.health_id_number ?? `#${patient.id}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: System overview metrics ── */}
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="stat-card">
          <div className="stat-card__head">
            <p className="stat-card__label">Adherence Rate</p>
            <span className="stat-indicator" data-live="true">
              <HeartPulse strokeWidth={1.9} />
            </span>
          </div>
          <p className="stat-card__value stat-card__value--sm">
            {loading ? "—" : fmtPct(overview?.adherence_rate)}
          </p>
          <Progress
            value={pct(overview?.adherence_rate)}
            variant="default"
            size="sm"
            className="mt-4"
          />
        </div>

        <div className="stat-card">
          <div className="stat-card__head">
            <p className="stat-card__label">Treatment Success</p>
            <span className="stat-indicator" data-live="true">
              <TrendingUp strokeWidth={1.9} />
            </span>
          </div>
          <p className="stat-card__value stat-card__value--sm">
            {loading ? "—" : fmtPct(overview?.treatment_success)}
          </p>
          <Progress
            value={pct(overview?.treatment_success)}
            variant="default"
            size="sm"
            className="mt-4"
          />
        </div>

        <div className="stat-card">
          <div className="stat-card__head">
            <p className="stat-card__label">Follow-up Rate</p>
            <span className="stat-indicator" data-live="true">
              <Activity strokeWidth={1.9} />
            </span>
          </div>
          <p className="stat-card__value stat-card__value--sm">
            {loading ? "—" : fmtPct(overview?.follow_up_rate)}
          </p>
          <Progress
            value={pct(overview?.follow_up_rate)}
            variant="warning"
            size="sm"
            className="mt-4"
          />
        </div>
      </div>
    </div>
  );
}
