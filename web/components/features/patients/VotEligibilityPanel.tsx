"use client";

/**
 * A patient's Video-Observed Therapy eligibility, inside the patient profile.
 *
 * Eligibility is a clinical decision by the facility: a nurse enrols the
 * patient, assigns the nurse who reviews their proofs, and can suspend or
 * revoke it later (with a reason). Every change is audited server-side and the
 * patient is told in the app.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Pencil, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/services/api";
import { getVotEnrollment, getVotNurses, updateVotEnrollment } from "@/lib/services/vot";
import type { IVotEnrollment, IVotEnrollmentPayload, IVotNurse, VotEnrollmentStatus } from "@/lib/types";
import { fmtDate, fmtDateTime, isoDay } from "@/components/features/reports/vot/VotStatusBadge";

const SELECT_CLASSES =
  "flex h-10 w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

const STATUS_META: Record<VotEnrollmentStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  active: { label: "Eligible — active", variant: "success" },
  suspended: { label: "Suspended", variant: "warning" },
  revoked: { label: "Revoked", variant: "danger" },
};

interface VotEligibilityPanelProps {
  patientId: number;
  /** VOT needs the patient's mobile account to record proofs. */
  hasMobileAccount: boolean;
}

export function VotEligibilityPanel({ patientId, hasMobileAccount }: VotEligibilityPanelProps) {
  const [enrollment, setEnrollment] = useState<IVotEnrollment | null>(null);
  const [nurses, setNurses] = useState<IVotNurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<IVotEnrollmentPayload>({ status: "active" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [enrollmentRes, nursesRes] = await Promise.all([getVotEnrollment(patientId), getVotNurses()]);
      setEnrollment(enrollmentRes.data ?? null);
      setNurses(nursesRes.data ?? []);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load VOT eligibility."));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (status?: VotEnrollmentStatus) => {
    setForm({
      status: status ?? enrollment?.status ?? "active",
      eligible_since: enrollment?.eligible_since ?? isoDay(new Date()),
      assigned_nurse_id: enrollment?.assigned_nurse_id ?? null,
      notes: enrollment?.notes ?? "",
      status_reason: status && status !== enrollment?.status ? "" : enrollment?.status_reason ?? "",
    });
    setSaveError("");
    setEditing(true);
  };

  const needsReason = form.status !== "active";

  const save = async () => {
    if (needsReason && !form.status_reason?.trim()) {
      setSaveError("Please give a reason for suspending or revoking VOT.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await updateVotEnrollment(patientId, {
        ...form,
        notes: form.notes?.trim() || null,
        status_reason: needsReason ? form.status_reason?.trim() : null,
        eligible_since: form.eligible_since || null,
      });
      setEnrollment(res.data ?? null);
      setEditing(false);
    } catch (err) {
      setSaveError(errorMessage(err, "Could not save VOT eligibility."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-border-light p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
          <Video className="h-4 w-4 text-primary-600" />
          Video-Observed Therapy
        </h3>
        {!loading && !editing && enrollment && (
          <Badge variant={STATUS_META[enrollment.status].variant} size="sm">
            {STATUS_META[enrollment.status].label}
          </Badge>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : loadError ? (
        <div className="flex items-center gap-2 text-sm text-danger-text">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {loadError}
          <Button variant="link" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      ) : editing ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="vot-status" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Eligibility
              </label>
              <select
                id="vot-status"
                className={SELECT_CLASSES}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as VotEnrollmentStatus })}
              >
                <option value="active">Eligible (active)</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            <div>
              <label htmlFor="vot-since" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Eligible since
              </label>
              <Input
                id="vot-since"
                type="date"
                max={isoDay(new Date())}
                value={form.eligible_since ?? ""}
                onChange={(e) => setForm({ ...form, eligible_since: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="vot-nurse" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Assigned nurse
              </label>
              <select
                id="vot-nurse"
                className={SELECT_CLASSES}
                value={form.assigned_nurse_id ?? ""}
                onChange={(e) => setForm({ ...form, assigned_nurse_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Unassigned (all staff notified)</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsReason && (
            <div>
              <label htmlFor="vot-reason" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Reason for {form.status === "suspended" ? "suspending" : "revoking"} (required)
              </label>
              <Input
                id="vot-reason"
                maxLength={500}
                value={form.status_reason ?? ""}
                onChange={(e) => setForm({ ...form, status_reason: e.target.value })}
                placeholder="e.g. Patient no longer has a working phone"
              />
            </div>
          )}

          <div>
            <label htmlFor="vot-notes" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Notes
            </label>
            <Textarea
              id="vot-notes"
              rows={2}
              maxLength={2000}
              className="min-h-[64px]"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Why the patient qualifies, observation protocol notes…"
            />
          </div>

          {saveError && <p className="text-xs text-danger-text">{saveError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={save}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save eligibility
            </Button>
          </div>
        </div>
      ) : enrollment ? (
        <div className="space-y-3">
          <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
            <Row label="Eligible since" value={fmtDate(enrollment.eligible_since)} />
            <Row label="Assigned nurse" value={enrollment.assigned_nurse_name ?? "Unassigned"} />
            <Row label="Granted by" value={enrollment.granted_by_name ?? "—"} />
            <Row
              label="Last change"
              value={
                enrollment.status_changed_at
                  ? `${fmtDateTime(enrollment.status_changed_at)}${enrollment.status_changed_by_name ? ` · ${enrollment.status_changed_by_name}` : ""}`
                  : "—"
              }
            />
          </dl>
          {enrollment.status !== "active" && enrollment.status_reason && (
            <p className="rounded-[10px] bg-warning-bg px-3 py-2 text-xs text-warning-text">
              Reason: {enrollment.status_reason}
            </p>
          )}
          {enrollment.notes && <p className="text-xs text-text-secondary">{enrollment.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => startEdit()}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            {enrollment.status === "active" ? (
              <Button variant="ghost" size="sm" onClick={() => startEdit("suspended")}>
                Suspend
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => startEdit("active")}>
                Reactivate
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[13px] text-text-secondary">
            Not enrolled. Eligible patients record each dose on video (or photo) in the app for a nurse to review,
            instead of a plain confirmation.
            {!hasMobileAccount && " This patient needs a mobile account before they can submit proof."}
          </p>
          <Button size="sm" onClick={() => startEdit("active")}>
            <Video className="h-4 w-4" />
            Enrol in VOT
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}
