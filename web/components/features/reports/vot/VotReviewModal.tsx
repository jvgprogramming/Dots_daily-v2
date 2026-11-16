"use client";

/**
 * Review one VOT proof: who, which dose, the recording itself, earlier
 * attempts, and the three decisions. Every decision goes through an explicit
 * confirm step, and rejecting / asking again needs a reason the patient sees.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/services/api";
import { getVotSubmission, reviewVotSubmission } from "@/lib/services/vot";
import type { IVotSubmission, IVotSubmissionDetail, VotReviewAction } from "@/lib/types";
import {
  VotDoseBadge,
  VotSubmissionBadge,
  fmtBytes,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtTime,
} from "./VotStatusBadge";

interface VotReviewModalProps {
  submissionId: number | null;
  onClose: () => void;
  /** Called with the updated row after a decision, so the table can refresh. */
  onReviewed: (updated: IVotSubmission) => void;
}

const ACTIONS: Record<
  VotReviewAction,
  {
    label: string;
    confirmLabel: string;
    confirmText: string;
    needsReason: boolean;
    reasonLabel: string;
    variant: "primary" | "destructive" | "outline";
    icon: React.ElementType;
  }
> = {
  verify: {
    label: "Verify dose",
    confirmLabel: "Yes, verify dose",
    confirmText: "The dose is marked as observed and verified under your name. This cannot be undone.",
    needsReason: false,
    reasonLabel: "Note (optional)",
    variant: "primary",
    icon: CheckCircle2,
  },
  reject: {
    label: "Reject",
    confirmLabel: "Reject submission",
    confirmText: "The dose stops counting toward adherence. The recording is kept for the record.",
    needsReason: true,
    reasonLabel: "Why is this proof rejected? The patient will see this.",
    variant: "destructive",
    icon: XCircle,
  },
  "request-resubmission": {
    label: "Request new proof",
    confirmLabel: "Send request",
    confirmText: "The patient is notified to record this dose again. It is held out of adherence until new proof arrives.",
    needsReason: true,
    reasonLabel: "What should the patient do differently? They will see this.",
    variant: "outline",
    icon: RotateCcw,
  },
};

export function VotReviewModal({ submissionId, onClose, onReviewed }: VotReviewModalProps) {
  const [detail, setDetail] = useState<IVotSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mediaFailed, setMediaFailed] = useState(false);

  const [action, setAction] = useState<VotReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError("");
    setMediaFailed(false);
    try {
      const res = await getVotSubmission(id);
      if (res.data) setDetail(res.data);
    } catch (err) {
      setError(errorMessage(err, "Could not load this submission."));
    } finally {
      setLoading(false);
    }
  }, []);

  // A different submission was opened: start from a clean slate (adjusted
  // during render), then fetch it.
  const [seenId, setSeenId] = useState(submissionId);
  if (seenId !== submissionId) {
    setSeenId(submissionId);
    setDetail(null);
    setAction(null);
    setReason("");
    setActionError("");
  }

  useEffect(() => {
    if (submissionId) load(submissionId);
  }, [submissionId, load]);

  const confirm = async () => {
    if (!detail || !action) return;
    const meta = ACTIONS[action];
    if (meta.needsReason && reason.trim().length === 0) {
      setActionError("Please enter a reason.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      const res = await reviewVotSubmission(detail.id, action, reason.trim() || undefined);
      if (res.data) onReviewed(res.data);
      // Re-read so the status and the attempt history show the decision.
      await load(detail.id);
      setAction(null);
      setReason("");
    } catch (err) {
      setActionError(errorMessage(err, "Could not save the decision."));
    } finally {
      setSubmitting(false);
    }
  };

  const d = detail;

  return (
    <Modal
      open={submissionId !== null}
      onClose={onClose}
      title="Review Video-Observed Dose"
      description={d ? `${d.patient.name} · ${fmtDate(d.dose.scheduled_date)} · attempt ${d.attempt}` : undefined}
      size="xl"
    >
      {loading && !d && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="aspect-video w-full rounded-[12px]" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-[10px] bg-danger-bg p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-danger" />
          <p className="text-sm text-danger-text">{error}</p>
        </div>
      )}

      {d && (
        <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* ── Video evidence ── */}
            <section className="space-y-2">
              {mediaFailed ? (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border-light bg-bg-subtle text-center">
                  <p className="max-w-xs text-sm text-text-secondary">
                    The secure link has expired or the file could not be loaded.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => load(d.id)}>
                    <RefreshCw className="h-4 w-4" />
                    Reload
                  </Button>
                </div>
              ) : d.media_type === "video" ? (
                <video
                  key={d.media_url}
                  src={d.media_url}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  onError={() => setMediaFailed(true)}
                  className="aspect-video w-full rounded-[12px] border border-border-light bg-black object-contain"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={d.media_url}
                  src={d.media_url}
                  alt={`Proof photo from ${d.patient.name}`}
                  onError={() => setMediaFailed(true)}
                  className="max-h-[60vh] w-full rounded-[12px] border border-border-light bg-bg-subtle object-contain"
                />
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                <span className="capitalize">{d.media_type}</span>
                {d.media_type === "video" && <span>Duration {fmtDuration(d.duration_seconds)}</span>}
                <span>{fmtBytes(d.media_size)}</span>
                <span>Submitted {fmtDateTime(d.submitted_at)}</span>
              </div>
            </section>

            {/* ── Patient + dose ── */}
            <section className="space-y-3">
              <InfoBlock title="Patient">
                <InfoRow label="Name" value={d.patient.name} />
                <InfoRow label="Patient ID" value={d.patient.health_id_number ?? `#${d.patient.id}`} />
                <InfoRow
                  label="Treatment"
                  value={
                    d.treatment
                      ? [d.treatment.regimen_type, d.treatment.phase, d.treatment.status].filter(Boolean).join(" · ")
                      : "—"
                  }
                />
                <InfoRow label="Assigned nurse" value={d.patient.assigned_nurse_name ?? "Unassigned"} />
              </InfoBlock>
              <InfoBlock title="Dose">
                <InfoRow label="Medication" value={d.dose.medication_name ?? "—"} />
                <InfoRow label="Dosage" value={d.dose.dose_quantity ?? d.dose.dosage ?? "—"} />
                <InfoRow label="Scheduled" value={`${fmtDate(d.dose.scheduled_date)} · ${fmtTime(d.dose.scheduled_time)}`} />
                <InfoRow label="Reported taken" value={fmtDateTime(d.dose.taken_at)} />
                <InfoRow label="Submitted" value={fmtDateTime(d.submitted_at)} />
              </InfoBlock>
            </section>
          </div>

          {/* ── Attempt history ── */}
          {d.history.length > 1 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Submission history
              </h3>
              <ol className="space-y-2">
                {d.history.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-border-light px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-text-primary">Attempt {h.attempt}</span>
                    <VotSubmissionBadge status={h.status} />
                    <span className="text-text-tertiary">{fmtDateTime(h.submitted_at)}</span>
                    {h.reviewed_by_name && <span className="text-text-secondary">by {h.reviewed_by_name}</span>}
                    {h.review_reason && <span className="w-full text-text-secondary">“{h.review_reason}”</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Verification ── */}
          <section className="rounded-[12px] border border-border-light p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <ShieldCheck className="h-4 w-4 text-primary-600" />
                Verification
              </h3>
              <div className="flex items-center gap-2">
                <VotSubmissionBadge status={d.status} />
                {d.dose.verification_status && <VotDoseBadge status={d.dose.verification_status} />}
              </div>
            </div>

            {d.status !== "pending" ? (
              <p className="text-sm text-text-secondary">
                Reviewed by <span className="font-medium text-text-primary">{d.reviewed_by_name ?? "—"}</span> on{" "}
                {fmtDateTime(d.reviewed_at)}
                {d.review_reason ? <> — “{d.review_reason}”</> : null}
              </p>
            ) : action === null ? (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ACTIONS) as VotReviewAction[]).map((key) => {
                  const meta = ACTIONS[key];
                  const Icon = meta.icon;
                  return (
                    <Button key={key} variant={meta.variant} size="sm" onClick={() => setAction(key)}>
                      <Icon className="h-4 w-4" />
                      {meta.label}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">{ACTIONS[action].confirmText}</p>
                <div>
                  <label htmlFor="vot-reason" className="mb-1.5 block text-xs font-medium text-text-secondary">
                    {ACTIONS[action].reasonLabel}
                  </label>
                  <Textarea
                    id="vot-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="min-h-[72px]"
                    error={Boolean(actionError)}
                    placeholder={
                      action === "verify"
                        ? "e.g. Clear view of swallowing"
                        : "e.g. The medicine was not visible before swallowing"
                    }
                  />
                </div>
                {actionError && <p className="text-xs text-danger-text">{actionError}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setAction(null)}>
                    Back
                  </Button>
                  <Button variant={ACTIONS[action].variant === "outline" ? "primary" : ACTIONS[action].variant} size="sm" disabled={submitting} onClick={confirm}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {ACTIONS[action].confirmLabel}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-bg-subtle p-3.5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-[13px]">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}
