"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Pill,
  Activity,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Calendar,
  HeartPulse,
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

const stats = [
  {
    title: "Total Patients",
    value: "0",
    icon: Users,
    change: "+0 this month",
    trend: "up",
  },
  {
    title: "Active Treatments",
    value: "0",
    icon: Pill,
    change: "+0 this week",
    trend: "up",
  },
  {
    title: "Pending Reviews",
    value: "0",
    icon: Activity,
    change: "0 require attention",
    trend: "neutral",
  },
  {
    title: "Critical Alerts",
    value: "0",
    icon: AlertTriangle,
    change: "0 urgent",
    trend: "down",
  },
];

const adherenceData = [
  { month: "Jan", rate: 0 },
  { month: "Feb", rate: 0 },
  { month: "Mar", rate: 0 },
  { month: "Apr", rate: 0 },
  { month: "May", rate: 0 },
  { month: "Jun", rate: 0 },
];

const patientActivity = [
  { day: "Mon", new: 0, followups: 0 },
  { day: "Tue", new: 0, followups: 0 },
  { day: "Wed", new: 0, followups: 0 },
  { day: "Thu", new: 0, followups: 0 },
  { day: "Fri", new: 0, followups: 0 },
  { day: "Sat", new: 0, followups: 0 },
  { day: "Sun", new: 0, followups: 0 },
];

const treatmentDistribution = [
  { phase: "Intensive", count: 0, color: "bg-primary-500", percentage: 0 },
  { phase: "Continuation", count: 0, color: "bg-warning", percentage: 0 },
  { phase: "Completed", count: 0, color: "bg-primary-700", percentage: 0 },
  { phase: "Interrupted", count: 0, color: "bg-danger", percentage: 0 },
];

const recentPatients = [
  { name: "No recent registrations", id: "—", date: "—" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-[10px] border border-border-light bg-bg-card px-4 py-3 shadow-dropdown">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm text-text-secondary">
            {entry.name}:{" "}
            <span className="font-medium text-text-primary">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-[36px] font-bold tracking-tight text-text-primary">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Overview of the tuberculosis treatment monitoring system.
        </p>
      </div>

      {/* ── KPI Row (compact metric cards) ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const trendColors: Record<string, string> = {
            up: "text-primary-600",
            down: "text-danger",
            neutral: "text-text-tertiary",
          };
          return (
            <div
              key={i}
              className="rounded-[16px] border border-border-light bg-bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-text-secondary">{stat.title}</p>
                  <p className="text-[30px] font-bold leading-none text-text-primary">
                    {stat.value}
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-bg-subtle">
                  <Icon className="h-[18px] w-[18px] text-text-tertiary" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColors[stat.trend]}`}
                >
                  {stat.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Charts Row (2-up, wider left chart) ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Adherence Trend - wider */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Adherence Rate</CardTitle>
                <CardDescription>
                  Monthly medication adherence trend
                </CardDescription>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary-50">
                <TrendingUp className="h-[18px] w-[18px] text-primary-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
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
                        <stop offset="0%" stopColor="#16a34a" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e8ecf0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#16a34a"
                      strokeWidth={2}
                      fill="url(#adherenceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Treatment Distribution - compact */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Treatment Phases</CardTitle>
              <CardDescription>
                Distribution by DOTS phase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {treatmentDistribution.map((item) => (
                <div key={item.phase}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-text-primary font-medium">
                        {item.phase}
                      </span>
                    </div>
                    <span className="text-sm text-text-tertiary">
                      {item.count}
                    </span>
                  </div>
                  <Progress value={item.percentage} size="sm" />
                </div>
              ))}

              {treatmentDistribution.every((t) => t.count === 0) && (
                <p className="text-sm text-text-tertiary text-center pt-2">
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
            <CardDescription>
              Latest patient registrations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border-light">
              {recentPatients.map((patient, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-6 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-bg-subtle">
                    <Users className="h-4 w-4 text-text-tertiary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {patient.name}
                    </p>
                    <p className="text-xs text-text-tertiary">{patient.date}</p>
                  </div>
                  <Badge variant="outline" size="sm">
                    {patient.id}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Patient Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Patient Activity</CardTitle>
              <CardDescription>
                New patients and follow-ups this week
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-bg-subtle">
              <Calendar className="h-[18px] w-[18px] text-text-tertiary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientActivity} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e8ecf0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />                    <Bar
                      dataKey="new"
                      name="New Patients"
                      fill="#16a34a"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="followups"
                      name="Follow-ups"
                      fill="#4ade80"
                      radius={[4, 4, 0, 0]}
                    />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: System overview metrics ── */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-[16px] border border-border-light bg-bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-secondary">Adherence Rate</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-success-bg">
              <HeartPulse className="h-4 w-4 text-success" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-text-primary">0%</p>
          <Progress value={0} variant="default" size="sm" className="mt-3" />
        </div>

        <div className="rounded-[16px] border border-border-light bg-bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-secondary">Treatment Success</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary-50">
              <TrendingUp className="h-4 w-4 text-primary-500" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-text-primary">0%</p>
          <Progress value={0} variant="default" size="sm" className="mt-3" />
        </div>

        <div className="rounded-[16px] border border-border-light bg-bg-card p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-secondary">Follow-up Rate</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-warning-bg">
              <Activity className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-text-primary">0%</p>
          <Progress value={0} variant="warning" size="sm" className="mt-3" />
        </div>
      </div>
    </div>
  );
}
