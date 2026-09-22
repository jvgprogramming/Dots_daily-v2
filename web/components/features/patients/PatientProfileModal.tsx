"use client";

/**
 * Patient Profile Modal — the continuing record view of a registered patient.
 *
 * Reflects everything captured during registration:
 * demographics, account, notification/facility, diagnosis, TB classification,
 * laboratory tests, treatment start, and close contacts. Monitoring/outcome
 * sections appear once recorded later in treatment.
 */

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Pencil, PlayCircle, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPatient } from "@/lib/services/patients";
import type {
  PatientDetailResponse,
  LaboratoryTestRecord,
  CloseContactRecord,
} from "@/lib/types";

// ─── Label maps (mirror the registration wizard) ───
const TEST_TYPE_LABELS: Record<string, string> = {
  xpert: "Xpert MTB/RIF",
  xpert_ultra: "Xpert MTB/RIF Ultra",
  smear: "Smear Microscopy",
  tb_lamp: "TB LAMP",
  cxr: "Chest X-ray",
  tst: "Tuberculin Skin Test",
  other: "Other",
};

const NOTIFICATION_REASON_LABELS: Record<string, string> = {
  new: "New / Diagnosis",
  update: "Update / Start of Treatment",
  final_outcome: "Final Outcome",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  bacteriologically_confirmed: "Bacteriologically-confirmed TB",
  clinically_diagnosed: "Clinically-diagnosed TB",
  pulmonary: "Pulmonary",
  extrapulmonary: "Extra-pulmonary",
  drug_susceptible: "Drug-susceptible",
  bc_rr_tb: "Bacteriologically-confirmed RR-TB",
  bc_mdr_tb: "Bacteriologically-confirmed MDR-TB",
  bc_xdr_tb: "Bacteriologically-confirmed XDR-TB",
  cd_mdr_tb: "Clinically-diagnosed MDR-TB",
  other_dr_resistant: "Other drug-resistant TB",
  new: "New",
  relapse: "Relapse",
  taf: "TAF — Treatment After Failure",
  tpt: "TPT — TB Preventive Treatment",
  talf: "TALF — Treatment After Loss to Follow-up",
  unknown_history: "Unknown History",
  tb_disease: "TB Disease",
  tb_infection: "TB Infection",
};

const REGIMEN_LABELS: Record<string, string> = {
  "2HRZE/4HR": "2HRZE / 4HR — DS-TB standard (6 mo)",
  "2HRZE/10HR": "2HRZE / 10HR — extended (12 mo)",
  "9H": "9H — TB infection, 9 months isoniazid",
  "3HP": "3HP — TB infection, 3 months HP",
  "4R": "4R — TB infection, 4 months rifampicin",
  BPaLM: "BPaLM — RR/MDR-TB (6 mo)",
  BPaL: "BPaL — RR/MDR-TB (6 mo)",
  "9-11 mo MDR": "9–11 month MDR regimen",
  individualized: "Individualized MDR/XDR regimen",
};

const TREATMENT_OUTCOME_LABELS: Record<string, string> = {
  cured: "Cured",
  treatment_completed: "Treatment Completed",
  died: "Died",
  failed: "Failed",
  lost_to_followup: "Lost to Follow-up",
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-tertiary shrink-0">{l}</span>
      <span className="text-text-primary text-right">{value || "—"}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border-light p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-2.5">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export interface PatientProfileModalProps {
  open: boolean;
  patientId: number | null;
  onClose: () => void;
  onEdit: (patientId: number) => void;
  onResumeDraft: (patientId: number) => void;
  /** Opens the treatment lifecycle update flow (Treatments tab workflow). */
  onUpdateTreatment?: (planId: number) => void;
}

export function PatientProfileModal({ open, patientId, onClose, onEdit, onResumeDraft, onUpdateTreatment }: PatientProfileModalProps) {
  const [data, setData] = useState<PatientDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !patientId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    getPatient(patientId)
      .then((res) => {
        if (!cancelled && res.data) setData(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load patient profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, patientId]);

  const p = data?.patient;
  const isDraft = p?.status === "draft";
  const classification = p?.tb_classification?.[0];
  const notification = p?.tb_notifications?.[0];
  const diagnosis = p?.diagnoses?.[0];
  const plan = data?.recent_activity?.treatment_plans?.[0];

  return (
    <Modal open={open} onClose={onClose} title="Patient Profile" description="Registration record and treatment overview" size="xl">
      {loading && (
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
            <p className="text-sm text-text-tertiary">Loading patient profile...</p>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-3 rounded-[10px] bg-danger-bg p-4">
          <AlertCircle className="h-5 w-5 text-danger shrink-0" />
          <p className="text-sm text-danger-text">{error}</p>
        </div>
      )}

      {!loading && !error && p && (
        <div className="flex flex-col" style={{ maxHeight: "calc(100vh - 240px)" }}>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
            {/* ── Identity header ── */}
            <div className="flex items-center justify-between gap-4 rounded-[12px] bg-bg-subtle p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-500 text-white text-base font-semibold">
                  {(p.first_name || data?.user?.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-text-primary truncate">
                      {p.last_name
                        ? `${p.last_name}, ${p.first_name}${p.name_extension ? ` ${p.name_extension}` : ""}${p.middle_name ? ` ${p.middle_name.charAt(0)}.` : ""}`
                        : data?.user?.name || "Unnamed patient"}
                    </p>
                    {isDraft && <Badge variant="warning" size="sm">Draft</Badge>}
                  </div>
                  <p className="text-xs text-text-tertiary truncate">
                    {data?.user?.email || "No account yet"} · Registered {fmtDate(p.registered_at)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-text-tertiary uppercase tracking-wider">Registration Group</p>
                <p className="text-sm font-medium text-text-primary">
                  {classification ? label(CLASSIFICATION_LABELS, classification.registration_group) : "Not classified"}
                </p>
              </div>
            </div>

            {/* ── Draft banner ── */}
            {isDraft && (
              <div className="flex items-center gap-3 rounded-[10px] bg-warning-bg p-4">
                <AlertCircle className="h-5 w-5 text-warning-text shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warning-text">Draft registration — not yet finalized.</p>
                  <p className="text-xs text-warning-text/80 mt-0.5">Resume the wizard to complete the TB registration.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => onResumeDraft(p.id)}>
                  <PlayCircle className="h-4 w-4" />
                  Resume
                </Button>
              </div>
            )}

            {/* ── Patient Information ── */}
            <Group title="Patient Information">
              <Row label="Surname" value={p.last_name || "—"} />
              <Row label="Given Name" value={p.first_name || "—"} />
              <Row label="Middle Name" value={p.middle_name || "—"} />
              <Row label="Name Extension" value={p.name_extension || "—"} />
              <Row label="Date of Birth" value={fmtDate(p.date_of_birth)} />
              <Row label="Sex" value={p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "—"} />
              <Row label="Civil Status" value={p.civil_status ? p.civil_status.charAt(0).toUpperCase() + p.civil_status.slice(1) : "—"} />
              <Row label="Weight (kg)" value={p.weight_kg != null && p.weight_kg !== "" ? `${p.weight_kg} kg` : "—"} />
              <Row label="Nationality" value={p.nationality || "—"} />
              <Row label="Address" value={p.address || "—"} />
              <Row label="PhilHealth" value={p.philhealth_number || "—"} />
              <Row label="Health ID" value={p.health_id_number || "—"} />
              <Row label="Occupation" value={p.occupation || "—"} />
              <Row label="Emergency Contact" value={[p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(" · ")} />
            </Group>

            {/* ── Account ── */}
            <Group title="Account">
              <Row label="Email" value={data?.user?.email || "—"} />
              <Row label="Phone" value={data?.user?.phone || "—"} />
              <Row label="Status" value={data?.user?.is_active === false ? "Inactive" : data?.user ? "Active" : "Not created yet"} />
            </Group>

            {/* ── Facility / Notification ── */}
            <Group title="Facility / Notification">
              {notification ? (
                <>
                  <Row label="Reason" value={label(NOTIFICATION_REASON_LABELS, notification.reason)} />
                  <Row label="Facility" value={notification.facility_name || "—"} />
                  <Row label="NTP Facility Code" value={notification.ntp_facility_code || "—"} />
                  <Row label="Province / HUC" value={notification.province_huc || "—"} />
                  <Row label="Region" value={notification.region || "—"} />
                </>
              ) : (
                <p className="text-sm text-text-tertiary">No notification recorded yet.</p>
              )}
            </Group>

            {/* ── Diagnosis ── */}
            <Group title="Diagnosis">
              {diagnosis ? (
                <>
                  <Row label="Diagnosis" value={label(CLASSIFICATION_LABELS, diagnosis.diagnosis_type)} />
                  <Row label="Date of Diagnosis" value={fmtDate(diagnosis.diagnosis_date)} />
                  <Row label="Date of Notification" value={fmtDate(diagnosis.notification_date)} />
                  <Row label="TB / TPT Case Number" value={diagnosis.case_number || "—"} />
                  <Row label="Attending Physician" value={diagnosis.attending_physician || "—"} />
                  {(diagnosis.referral_name || diagnosis.referral_facility_code) && (
                    <>
                      <Row label="Referred From" value={diagnosis.referral_name || "—"} />
                      <Row label="Referral Facility Code" value={diagnosis.referral_facility_code || "—"} />
                      <Row label="Referral Address" value={diagnosis.referral_address || "—"} />
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-text-tertiary">No diagnosis recorded yet.</p>
              )}
            </Group>

            {/* ── TB Classification ── */}
            <Group title="TB Classification">
              {classification ? (
                <>
                  <Row label="Bacteriological Status" value={label(CLASSIFICATION_LABELS, classification.bacteriological_status)} />
                  <Row
                    label="Anatomical Site"
                    value={
                      classification.anatomical_site === "extrapulmonary"
                        ? `Extra-pulmonary${classification.extrapulmonary_site ? ` — ${classification.extrapulmonary_site}` : ""}`
                        : label(CLASSIFICATION_LABELS, classification.anatomical_site)
                    }
                  />
                  <Row label="Drug Resistance Status" value={label(CLASSIFICATION_LABELS, classification.drug_resistance_status)} />
                  <Row label="Registration Group" value={label(CLASSIFICATION_LABELS, classification.registration_group)} />
                </>
              ) : (
                <p className="text-sm text-text-tertiary">Not yet classified{isDraft ? " — complete the registration first." : "."}</p>
              )}
            </Group>

            {/* ── Laboratory Tests ── */}
            <Group title="Laboratory Tests">
              {p.laboratory_tests && p.laboratory_tests.length > 0 ? (
                p.laboratory_tests.map((t: LaboratoryTestRecord) => (
                  <div key={t.id} className="rounded-[8px] bg-bg-subtle/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">
                        {t.test_type === "other" ? t.test_name || "Other" : label(TEST_TYPE_LABELS, t.test_type)}
                      </p>
                      <Badge
                        variant={t.status === "done" ? "success" : t.status === "not_yet_done" ? "info" : "default"}
                        size="sm"
                      >
                        {t.status === "done" ? "Done" : t.status === "not_yet_done" ? "Not yet done" : "Not available"}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {t.status === "done" ? t.result || "No result recorded" : label({}, t.status)}
                      {t.test_date ? ` · ${fmtDate(t.test_date)}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-tertiary">No laboratory tests recorded.</p>
              )}
            </Group>

            {/* ── Treatment (live from the treatment plan — same source as the Treatments tab) ── */}
            <Group title="Treatment">
              {plan ? (
                <>
                  <Row label="Regimen at Start" value={label(REGIMEN_LABELS, plan.regimen_type)} />
                  <Row label="Start Date" value={fmtDate(plan.start_date)} />
                  <Row label="Phase" value={plan.phase ? plan.phase.charAt(0).toUpperCase() + plan.phase.slice(1) : "—"} />
                  <Row label="Expected End" value={fmtDate(plan.expected_end_date)} />
                  {plan.actual_end_date && <Row label="Actual End" value={fmtDate(plan.actual_end_date)} />}
                  <Row label="Status" value={plan.status ? plan.status.charAt(0).toUpperCase() + plan.status.slice(1) : "—"} />
                  <Row label="Regimen at End" value={plan.regimen_type_end ? label(REGIMEN_LABELS, plan.regimen_type_end) : "To be recorded after treatment"} />
                  <Row
                    label="Treatment Outcome"
                    value={
                      plan.outcome
                        ? `${label(TREATMENT_OUTCOME_LABELS, plan.outcome)}${plan.outcome_date ? ` · ${fmtDate(plan.outcome_date)}` : ""}`
                        : "To be recorded after treatment"
                    }
                  />
                  {plan.outcome && plan.outcome_reason && <Row label="Outcome Reason" value={plan.outcome_reason} />}
                  {plan.notes && <Row label="Notes" value={plan.notes} />}
                  {onUpdateTreatment && !isDraft && (
                    <div className="pt-1.5">
                      <Button variant="outline" size="sm" onClick={() => onUpdateTreatment(plan.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Update Treatment
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-text-tertiary">No treatment plan yet{isDraft ? " — created when registration is completed." : "."}</p>
              )}
            </Group>

            {/* ── Close Contacts ── */}
            <Group title="Close Contacts">
              {p.close_contacts && p.close_contacts.length > 0 ? (
                p.close_contacts.map((c: CloseContactRecord) => (
                  <div key={c.id} className="rounded-[8px] bg-bg-subtle/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{c.full_name}</p>
                      <p className="text-xs text-text-secondary">
                        {[c.relationship, c.sex ? c.sex.charAt(0).toUpperCase() + c.sex.slice(1) : "", c.age ? `Age ${c.age}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {c.screening_date ? `Screening ${fmtDate(c.screening_date)}` : "Screening not scheduled"}
                      {c.followup_date ? ` · Follow-up ${fmtDate(c.followup_date)}` : ""}
                      {c.remarks ? ` · ${c.remarks}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-tertiary">No close contacts registered.</p>
              )}
            </Group>

            {/* ── Monitoring placeholder (added later in treatment) ── */}
            <Group title="Monitoring">
              <Row label="Daily Monitoring Entries" value={String(data?.stats.total_monitoring_sessions ?? 0)} />
              <Row label="Medication Logs" value={String(data?.stats.total_medication_logs ?? 0)} />
              <Row label="Active Treatment Plans" value={String(data?.stats.active_treatments ?? 0)} />
              <p className="text-[11px] text-text-tertiary pt-1">
                Progress notes, sputum and chest X-ray monitoring are added as treatment progresses.
              </p>
            </Group>
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border-light shrink-0">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <div className="flex items-center gap-2">
              {isDraft ? (
                <Button variant="primary" onClick={() => onResumeDraft(p.id)}>
                  <PlayCircle className="h-4 w-4" />
                  Resume Registration
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => onEdit(p.id)}>
                <Pencil className="h-4 w-4" />
                Edit Info
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
