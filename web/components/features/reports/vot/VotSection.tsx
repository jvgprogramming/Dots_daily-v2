"use client";

/**
 * Reports → Video-Observed Therapy: the nurse's review queue.
 *
 * Every number and row comes from the VOT tables via /vot/*. Pending proofs
 * sort to the top; opening one fetches a fresh signed media link (and is
 * recorded in the audit log).
 */

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Film,
  RefreshCw,
  Search,
  UserCheck,
  Video,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Table } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { errorMessage } from "@/lib/services/api";
import { getVotNurses, getVotSubmissions, getVotSummary } from "@/lib/services/vot";
import type {
  IVotNurse,
  IVotSubmission,
  IVotSubmissionFilters,
  IVotSummary,
  PaginatedResponse,
  VotSubmissionStatus,
} from "@/lib/types";
import { VotReviewModal } from "./VotReviewModal";
import {
  VOT_SUBMISSION_STATUS_OPTIONS,
  VotSubmissionBadge,
  fmtClock,
  fmtDate,
  fmtDuration,
  fmtTime,
  isoDay,
} from "./VotStatusBadge";

const SELECT_CLASSES =
  "flex h-10 w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

const TREATMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "interrupted", label: "Interrupted" },
  { value: "discontinued", label: "Discontinued" },
];

const PER_PAGE = 15;

interface VotSectionProps {
  /** Opens this submission's review on load (from a notification link). */
  initialSubmissionId?: number | null;
}

export function VotSection({ initialSubmissionId = null }: VotSectionProps) {
  const [summary, setSummary] = useState<IVotSummary | null>(null);
  const [page, setPage] = useState<PaginatedResponse<IVotSubmission> | null>(null);
  const [nurses, setNurses] = useState<IVotNurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters. The search box is debounced into `search` so typing doesn't
  // fire a request per keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VotSubmissionStatus | "">("");
  const [nurseId, setNurseId] = useState("");
  const [treatmentStatus, setTreatmentStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [reviewId, setReviewId] = useState<number | null>(initialSubmissionId);

  // Open a newly linked submission (adjusting state during render rather
  // than syncing it in an effect).
  const [seenInitialId, setSeenInitialId] = useState(initialSubmissionId);
  if (seenInitialId !== initialSubmissionId) {
    setSeenInitialId(initialSubmissionId);
    setReviewId(initialSubmissionId);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setError("");
    const filters: IVotSubmissionFilters = {
      search: search || undefined,
      status: status || undefined,
      nurse_id: nurseId ? Number(nurseId) : undefined,
      treatment_status: treatmentStatus || undefined,
      from: from || undefined,
      to: to || undefined,
      page: currentPage,
      per_page: PER_PAGE,
    };
    try {
      const [summaryRes, listRes] = await Promise.all([getVotSummary(), getVotSubmissions(filters)]);
      if (summaryRes.data) setSummary(summaryRes.data);
      setPage(listRes);
    } catch (err) {
      setError(errorMessage(err, "Could not load video-observed therapy data."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, nurseId, treatmentStatus, from, to, currentPage]);

  useEffect(() => {
    load();
  }, [load]);

  // New proofs from patients appear without a manual refresh.
  useAutoRefresh(load);

  useEffect(() => {
    getVotNurses()
      .then((res) => setNurses(res.data ?? []))
      .catch(() => setNurses([]));
  }, []);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setNurseId("");
    setTreatmentStatus("");
    setFrom("");
    setTo("");
    setCurrentPage(1);
  };

  const hasFilters = Boolean(search || status || nurseId || treatmentStatus || from || to);
  const rows = page?.data ?? [];

  const cards = [
    { title: "Total Submissions", value: summary?.total_submissions, icon: Film, hint: "All proofs received" },
    { title: "Pending Review", value: summary?.pending, icon: Clock, hint: "Waiting for a nurse", filter: "pending" as const },
    { title: "Verified Doses", value: summary?.verified, icon: CheckCircle2, hint: "Confirmed by a nurse", filter: "verified" as const },
    {
      title: "Rejected",
      value: summary ? summary.rejected + summary.resubmission_requested : undefined,
      icon: XCircle,
      hint: summary ? `${summary.resubmission_requested} sent back for new proof` : undefined,
      filter: "rejected" as const,
    },
    { title: "Enrolled in VOT", value: summary?.enrolled_patients, icon: UserCheck, hint: "Patients currently active" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-text-primary">Video-Observed Therapy</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Proof of intake recorded by enrolled patients. Pending doses count toward adherence until a nurse rejects them.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing || loading}
          onClick={() => {
            setRefreshing(true);
            load();
          }}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Could not load VOT data">
          {error}
        </Alert>
      )}

      {/* ── Overview ── */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          const clickable = Boolean(c.filter);
          const body = (
            <>
              <div className="stat-card__head">
                <p className="stat-card__label">{c.title}</p>
                <span className="stat-indicator" data-live="true">
                  <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                </span>
              </div>
              {loading ? (
                <Skeleton className="mt-4 h-7 w-14" />
              ) : (
                <p className="stat-card__value stat-card__value--sm text-text-primary">{c.value ?? 0}</p>
              )}
              {c.hint && <p className="stat-card__foot mt-3">{c.hint}</p>}
            </>
          );
          return clickable ? (
            <button
              key={c.title}
              type="button"
              className="stat-card text-left transition-shadow hover:shadow-card-hover"
              onClick={() => {
                setStatus(c.filter!);
                setCurrentPage(1);
              }}
              title={`Show ${c.title.toLowerCase()}`}
            >
              {body}
            </button>
          ) : (
            <div key={c.title} className="stat-card">
              {body}
            </div>
          );
        })}
      </div>

      {/* ── Submissions ── */}
      <Card>
        <CardHeader>
          <CardTitle>Video Submissions</CardTitle>
          <CardDescription>Pending proofs are listed first. Open one to watch it and record a decision.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(5,minmax(130px,1fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                aria-label="Search patient"
                placeholder="Search patient name or ID"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Verification status"
              className={SELECT_CLASSES}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as VotSubmissionStatus | "");
                setCurrentPage(1);
              }}
            >
              <option value="">All statuses</option>
              {VOT_SUBMISSION_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Assigned nurse"
              className={SELECT_CLASSES}
              value={nurseId}
              onChange={(e) => {
                setNurseId(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All nurses</option>
              {nurses.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Treatment status"
              className={SELECT_CLASSES}
              value={treatmentStatus}
              onChange={(e) => {
                setTreatmentStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All treatments</option>
              {TREATMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              aria-label="Submitted from"
              type="date"
              value={from}
              max={to || isoDay(new Date())}
              onChange={(e) => {
                setFrom(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Input
              aria-label="Submitted to"
              type="date"
              value={to}
              min={from || undefined}
              max={isoDay(new Date())}
              onChange={(e) => {
                setTo(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Button variant="ghost" size="sm" className="h-10" disabled={!hasFilters} onClick={resetFilters}>
              Clear
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Video className="h-5 w-5" />}
              title={hasFilters ? "No submissions match these filters" : "No video submissions yet"}
              description={
                hasFilters
                  ? "Try clearing a filter or widening the date range."
                  : "Enrol a patient in VOT from their profile. Their recorded doses will appear here for review."
              }
              action={hasFilters ? { label: "Clear filters", onClick: resetFilters } : undefined}
            />
          ) : (
            <Table
              data={rows}
              keyExtractor={(s) => s.id}
              onRowClick={(s) => setReviewId(s.id)}
              columns={[
                {
                  key: "patient",
                  header: "Patient",
                  cell: (s) => (
                    <div className="min-w-[140px]">
                      <p className="font-medium text-text-primary">{s.patient.name}</p>
                      <p className="text-xs text-text-tertiary">{s.patient.health_id_number ?? `#${s.patient.id}`}</p>
                    </div>
                  ),
                },
                {
                  key: "treatment",
                  header: "Treatment",
                  cell: (s) =>
                    s.treatment ? (
                      <div>
                        <p>{s.treatment.regimen_type ?? s.treatment.plan_name ?? "—"}</p>
                        <p className="text-xs capitalize text-text-tertiary">
                          {[s.treatment.phase, s.treatment.status].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ) : (
                      "—"
                    ),
                },
                { key: "medication", header: "Medication", cell: (s) => s.dose.medication_name ?? "—" },
                {
                  key: "scheduled",
                  header: "Scheduled Dose",
                  cell: (s) => (
                    <div>
                      <p>{fmtDate(s.dose.scheduled_date)}</p>
                      <p className="text-xs text-text-tertiary">{fmtTime(s.dose.scheduled_time)}</p>
                    </div>
                  ),
                },
                { key: "submitted_date", header: "Submitted", cell: (s) => fmtDate(s.submitted_at) },
                { key: "submitted_time", header: "Time", cell: (s) => fmtClock(s.submitted_at) },
                {
                  key: "duration",
                  header: "Duration",
                  cell: (s) => (s.media_type === "photo" ? <span className="text-text-tertiary">Photo</span> : fmtDuration(s.duration_seconds)),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (s) => (
                    <div className="space-y-1">
                      <VotSubmissionBadge status={s.status} />
                      {s.attempt > 1 && <p className="text-[11px] text-text-tertiary">Attempt {s.attempt}</p>}
                    </div>
                  ),
                },
                { key: "nurse", header: "Assigned Nurse", cell: (s) => s.patient.assigned_nurse_name ?? <span className="text-text-tertiary">Unassigned</span> },
                {
                  key: "actions",
                  header: "",
                  className: "text-right",
                  cell: (s) => (
                    <Button
                      variant={s.status === "pending" ? "primary" : "ghost"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReviewId(s.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      {s.status === "pending" ? "Review" : "View"}
                    </Button>
                  ),
                },
              ]}
            />
          )}

          {page && page.meta.last_page > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-text-tertiary">
                Showing {page.meta.from}–{page.meta.to} of {page.meta.total}
              </p>
              <Pagination
                currentPage={page.meta.current_page}
                totalPages={page.meta.last_page}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <VotReviewModal
        submissionId={reviewId}
        onClose={() => setReviewId(null)}
        onReviewed={() => load()}
      />
    </div>
  );
}
