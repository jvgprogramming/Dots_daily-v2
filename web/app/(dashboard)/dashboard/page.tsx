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
      <div className="rounded-[8px] border border-border-light bg-bg-card px-3 py-2.5 shadow-dropdown">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          {label}
        </p>
        {payload.map((entry, i: number) => (
          <p key={i} className="mt-1 flex items-baseline gap-2 text-[12px] text-text-body">
            {entry.name}
            <span className="ml-auto font-medium tabular-nums text-text-primary">
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

// Phase dots are held to the botanical palette regardless of backend classes.
const PHASE_DOT: Record<string, string> = {
  Intensive: "bg-brand-action",
  Continuation: "bg-primary-400",
  Completed: "bg-primary-500",
  Interrupted: "bg-danger/60",
};

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

  return (
    <div className="space-y-7">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-6">
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
            className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Could not load dashboard">
          {error}
        </Alert>
      )}

      {/* ── KPI Row (compact metric cards) ── */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-7 w-16" />
              <Skeleton className="mt-3 h-3 w-24" />
            </div>
          ))}

        {!loading &&
          stats.map((stat, i) => {
            const Icon = STAT_ICONS[i] ?? Activity;
            const trendColors: Record<string, string> = {
              up: "text-primary-600",
              down: "text-danger",
              neutral: "text-text-secondary",
            };
            return (
              <div key={stat.title} className="stat-card">
                <div className="stat-card__head">
                  <p className="stat-card__label">{stat.title}</p>
                  <span className="stat-indicator" data-live="true">
                    <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                  </span>
                </div>
                <p className="stat-card__value">{stat.value}</p>
                <div className="mt-3 flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${trendColors[stat.trend]}`}
                  >
                    {stat.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                    {stat.change}
                  </span>
                </div>
                {stat.change_note && (
                  <p className="mt-1 text-[10.5px] leading-tight text-text-secondary">
                    {stat.change_note}
                  </p>
                )}
              </div>
            );
          })}
      </div>

      {/* ── Charts Row (2-up, wider left chart) ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Adherence Trend - wider */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Adherence Rate</CardTitle>
              <CardDescription>
                Monthly medication adherence trend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={adherenceData}>
                      <defs>
                        <linearGradient
                          id="adherenceGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="2 5"
                        stroke="var(--color-border-light)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickMargin={6}
                        tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <RechartsTooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        name="Adherence"
                        stroke="var(--color-primary-900)"
                        strokeWidth={1.75}
                        fill="url(#adherenceGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Treatment Distribution - compact */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Treatment Phases</CardTitle>
              <CardDescription>Distribution by DOTS phase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {treatmentDistribution.map((item) => (
                <div key={item.phase}>
                  <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          PHASE_DOT[item.phase] ?? item.color
                        }`}
                      />
                      <span className="font-medium text-text-primary">
                        {item.phase}
                      </span>
                    </div>
                    <span className="text-[11px] tabular-nums text-text-secondary">
                      {item.count}
                    </span>
                  </div>
                  <Progress value={item.percentage} size="sm" />
                </div>
              ))}

              {!loading && treatmentDistribution.every((t) => t.count === 0) && (
                <p className="pt-2 text-center text-[12.5px] text-text-secondary">
                  No treatment data yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Activity & Quick Stats Row ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent Patients List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Patients</CardTitle>
            <CardDescription>Latest patient registrations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 px-5 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : recentPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Users className="h-6 w-6 text-text-muted" strokeWidth={1.5} />
                <p className="text-[12.5px] text-text-secondary">
                  No recent registrations
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-light">
                {recentPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center gap-3 px-5 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] bg-primary-100/60">
                      <Users className="h-3.5 w-3.5 text-primary-800" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[12.5px] font-medium leading-tight text-text-primary">
                        {patient.name}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-tight text-text-secondary">
                        {patient.date ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant={patient.status === "draft" ? "warning" : "outline"}
                      size="sm"
                    >
                      {patient.status === "draft" ? "Draft" : (patient.health_id_number ?? `#${patient.id}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Patient Activity</CardTitle>
            <CardDescription>
              New patients and follow-ups this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patientActivity} barGap={4} barCategoryGap="28%">
                    <CartesianGrid
                      strokeDasharray="2 5"
                      stroke="var(--color-border-light)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={6}
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
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
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="followups"
                      name="Follow-ups"
                      fill="var(--color-primary-300)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: System overview metrics ── */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <div className="stat-card">
          <div className="stat-card__head">
            <p className="stat-card__label">Adherence Rate</p>
            <span className="stat-indicator" data-live="true">
              <HeartPulse className="h-[15px] w-[15px]" strokeWidth={1.75} />
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
              <TrendingUp className="h-[15px] w-[15px]" strokeWidth={1.75} />
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
              <Activity className="h-[15px] w-[15px]" strokeWidth={1.75} />
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
