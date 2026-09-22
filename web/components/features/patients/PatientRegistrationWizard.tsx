"use client";

/**
 * Patient Registration Wizard — digital TB/DOTS registration form.
 *
 * Multi-step form matching the official TB notification form:
 * Account → Notification & Facility → Demographics → Laboratory Tests →
 * Diagnosis → TB Classification → Treatment → Close Contacts → Review.
 *
 * Outcomes fields (regimen at end, treatment outcome, post-treatment
 * follow-up) are intentionally NOT collected here — they are added later
 * from the patient profile as treatment progresses.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Building2,
  User,
  FlaskConical,
  Stethoscope,
  Layers,
  Pill,
  Users,
  ClipboardCheck,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { registerPatient, completePatientDraft } from "@/lib/services/patients";
import { ApiError } from "@/lib/services/api";
import type {
  PatientRegistrationPayload,
  LaboratoryTestEntry,
  CloseContactEntry,
  NotificationReason,
  LaboratoryTestType,
  LaboratoryTestStatus,
  DiagnosisType,
  BacteriologicalStatus,
  AnatomicalSite,
  DrugResistanceStatus,
  RegistrationGroup,
  PatientStatus,
} from "@/lib/types";

// ─── Wizard steps ───
const STEPS = [
  { id: "account", label: "Account", icon: UserPlus },
  { id: "notification", label: "Notification", icon: Building2 },
  { id: "demographics", label: "Demographics", icon: User },
  { id: "laboratory", label: "Lab Tests", icon: FlaskConical },
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope },
  { id: "classification", label: "Classification", icon: Layers },
  { id: "treatment", label: "Treatment", icon: Pill },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "review", label: "Review", icon: ClipboardCheck },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ─── Regimen options (official DOTS regimens) ───
const REGIMEN_OPTIONS = [
  { value: "2HRZE/4HR", label: "2HRZE / 4HR — DS-TB standard (6 mo)" },
  { value: "2HRZE/10HR", label: "2HRZE / 10HR — extended (12 mo)" },
  { value: "9H", label: "9H — TB infection, 9 months isoniazid" },
  { value: "3HP", label: "3HP — TB infection, 3 months HP" },
  { value: "4R", label: "4R — TB infection, 4 months rifampicin" },
  { value: "BPaLM", label: "BPaLM — RR/MDR-TB (6 mo)" },
  { value: "BPaL", label: "BPaL — RR/MDR-TB (6 mo)" },
  { value: "9-11 mo MDR", label: "9–11 month MDR regimen" },
  { value: "individualized", label: "Individualized MDR/XDR regimen" },
];

const SELECT_CLASSES =
  "flex h-11 w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

// ─── Philippine mobile number helpers ───
// Accepts 09XXXXXXXXX, 9XXXXXXXXX, or +639XXXXXXXXX (max 13 chars incl. country code).
const PH_PHONE_MAX_LENGTH = 13;
const PH_PHONE_REGEX = /^(?:\+639\d{9}|09\d{9}|9\d{9})$/;

function sanitizePhoneNumber(value: string): string {
  let cleaned = value.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = `+${cleaned.slice(1).replace(/\+/g, "")}`;
  } else {
    cleaned = cleaned.replace(/\+/g, "");
  }
  return cleaned.slice(0, PH_PHONE_MAX_LENGTH);
}

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1.5 block">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-0.5 w-4 rounded-full bg-primary-500" />
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
        {title}
      </h4>
      <Icon className="h-3.5 w-3.5 text-text-tertiary" />
    </div>
  );
}

function RadioRow({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 cursor-pointer transition-all duration-150 ${
            value === opt.value
              ? "border-primary-400 bg-primary-50/60"
              : "border-border-default hover:border-border-strong bg-bg-card"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="h-4 w-4 accent-primary-600"
          />
          <span className="text-sm text-text-primary">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Empty payload factory ───
export function emptyRegistrationForm(): PatientRegistrationPayload {
  return {
    status: "registered",
    name: "",
    email: "",
    phone: "",
    password: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    name_extension: "",
    date_of_birth: "",
    gender: "",
    civil_status: "",
    nationality: "Filipino",
    address: "",
    contact_number: "",
    philhealth_number: "",
    notification: {
      reason: "new",
      facility_name: "",
      ntp_facility_code: "",
      province_huc: "",
      region: "",
    },
    laboratory_tests: [],
    diagnosis: {
      diagnosis_type: "tb_disease",
      diagnosis_date: "",
      notification_date: "",
      case_number: "",
      attending_physician: "",
      referral_name: "",
      referral_address: "",
      referral_facility_code: "",
      referral_province_huc: "",
      referral_region: "",
    },
    classification: {
      bacteriological_status: "bacteriologically_confirmed",
      anatomical_site: "pulmonary",
      extrapulmonary_site: "",
      drug_resistance_status: "drug_susceptible",
      registration_group: "new",
    },
    treatment: { start_date: "", regimen_type: "", notes: "" },
    close_contacts: [],
  };
}

const EMPTY_LAB_TEST: LaboratoryTestEntry = {
  test_type: "xpert",
  test_name: "",
  test_date: "",
  result: "",
  status: "done",
  remarks: "",
};

const EMPTY_CONTACT: CloseContactEntry = {
  full_name: "",
  age: "",
  sex: "",
  relationship: "",
  screening_date: "",
  followup_date: "",
  remarks: "",
};

const LAB_TEST_TYPES: { value: LaboratoryTestType; label: string }[] = [
  { value: "xpert", label: "Xpert MTB/RIF" },
  { value: "xpert_ultra", label: "Xpert MTB/RIF Ultra" },
  { value: "smear", label: "Smear Microscopy" },
  { value: "tb_lamp", label: "TB LAMP" },
  { value: "cxr", label: "Chest X-ray" },
  { value: "tst", label: "Tuberculin Skin Test" },
  { value: "other", label: "Other" },
];

const LAB_TEST_STATUS: { value: LaboratoryTestStatus; label: string }[] = [
  { value: "done", label: "Done — result available" },
  { value: "not_available", label: "Not Available" },
  { value: "not_yet_done", label: "Not Yet Done" },
];

export interface PatientRegistrationWizardProps {
  open: boolean;
  onClose: () => void;
  /** Draft patient to resume (id + previously saved payload). */
  draft?: {
    patientId: number;
    payload: Partial<PatientRegistrationPayload>;
  } | null;
  onSaved: (message: string) => void;
}

export function PatientRegistrationWizard({ open, onClose, draft, onSaved }: PatientRegistrationWizardProps) {
  const [form, setForm] = useState<PatientRegistrationPayload>(
    () => ({ ...emptyRegistrationForm(), ...(draft?.payload ?? {}) })
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);

  const isResume = !!draft;
  const currentStep = STEPS[stepIndex];

  const update = <K extends keyof PatientRegistrationPayload>(
    field: K,
    value: PatientRegistrationPayload[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateSection = <K extends "notification" | "diagnosis" | "classification" | "treatment">(
    section: K,
    field: keyof PatientRegistrationPayload[K],
    value: string
  ) =>
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));

  // ── Per-step required-field validation ──
  const validateStep = (id: StepId): string[] => {
    const miss: string[] = [];
    switch (id) {
      case "account": {
        if (!form.email.trim()) miss.push("Email is required.");
        if (!isResume && form.password.length < 8) miss.push("Password must be at least 8 characters.");
        const contact = (form.contact_number || form.phone || "").replace(/[\s-]/g, "");
        if (contact && !PH_PHONE_REGEX.test(contact)) {
          miss.push("Contact number must be a valid Philippine mobile number (e.g., 09123456789 or +639123456789).");
        }
        break;
      }
      case "demographics":
        if (!form.last_name.trim()) miss.push("Surname is required.");
        if (!form.first_name.trim()) miss.push("Given name is required.");
        if (!form.date_of_birth) miss.push("Date of birth is required.");
        if (!form.gender) miss.push("Sex is required.");
        if (!form.address.trim()) miss.push("Permanent address is required.");
        break;
      case "diagnosis":
        if (!form.diagnosis.diagnosis_date) miss.push("Date of diagnosis is required.");
        break;
      case "treatment":
        if (!form.treatment.start_date) miss.push("Treatment start date is required.");
        if (!form.treatment.regimen_type) miss.push("Starting regimen is required.");
        break;
      default:
        break;
    }
    return miss;
  };

  const goNext = () => {
    const miss = validateStep(currentStep.id);
    setMissing(miss);
    if (miss.length === 0) setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goPrev = () => {
    setMissing([]);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  // Re-validate live while a warning is showing, so it clears as fields are fixed.
  useEffect(() => {
    if (missing.length > 0) setMissing(validateStep(currentStep.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, stepIndex]);

  // Build display name from parts
  const displayName = useMemo(() => {
    const parts = [form.first_name, form.middle_name, form.last_name, form.name_extension].filter(Boolean);
    return parts.join(" ") || form.name || "—";
  }, [form.first_name, form.middle_name, form.last_name, form.name_extension, form.name]);

  // ── Submit (final registration) ──
  const handleRegister = async () => {
    setError("");
    setSubmitting(true);
    try {
      const payload: PatientRegistrationPayload = {
        ...form,
        name: displayName === "—" ? "" : displayName,
        status: "registered" as PatientStatus,
      };
      if (isResume && draft) {
        await completePatientDraft(draft.patientId, payload);
        onSaved("Patient registration completed successfully.");
      } else {
        await registerPatient(payload);
        onSaved("Patient registered successfully.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.errors) {
        const details = Object.entries(err.errors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join("\n");
        setError(
          `Registration failed validation. Please fix the following:\n${details}`
        );
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
      {/* ── Error ── */}
      {error && (
        <Alert variant="danger" onClose={() => setError("")} className="mb-3 whitespace-pre-line">
          {error}
        </Alert>
      )}

      {/* ── Step indicator ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 shrink-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <button
              key={s.id}
              onClick={() => i < stepIndex && setStepIndex(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                active
                  ? "bg-primary-500 text-white"
                  : done
                  ? "bg-primary-50 text-primary-600 cursor-pointer"
                  : "bg-bg-subtle text-text-tertiary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Validation warning ── */}
      {missing.length > 0 && (
        <Alert variant="warning" title="Please complete the required fields" className="mb-3 shrink-0">
          <ul className="list-disc pl-4 space-y-0.5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto -mx-6 px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="space-y-4 pb-6"
          >
            {/* ══════════ STEP 0: ACCOUNT ══════════ */}
            {currentStep.id === "account" && (
              <>
                <SectionHeader icon={UserPlus} title="Account Setup" />
                <p className="text-xs text-text-tertiary -mt-2 mb-2">
                  The patient uses this account to sign in to the DOTS Daily mobile app.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Email Address" required>
                    <Input
                      type="email"
                      placeholder="juan@example.com"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Contact Number" hint="Philippine mobile format: 09123456789 or +639123456789.">
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="09123456789"
                      maxLength={PH_PHONE_MAX_LENGTH}
                      value={form.contact_number || form.phone}
                      onChange={(e) => update("contact_number", sanitizePhoneNumber(e.target.value))}
                    />
                  </Field>
                  {!isResume && (
                    <Field label="Password" required hint="Minimum 8 characters — share securely with the patient.">
                      <Input
                        type="password"
                        placeholder="Min. 8 characters"
                        value={form.password}
                        onChange={(e) => update("password", e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              </>
            )}

            {/* ══════════ STEP 1: NOTIFICATION ══════════ */}
            {currentStep.id === "notification" && (
              <>
                <SectionHeader icon={Building2} title="Notification & Facility" />
                <Field label="Reason for Notification" required>
                  <select
                    className={SELECT_CLASSES}
                    value={form.notification.reason}
                    onChange={(e) => updateSection("notification", "reason", e.target.value)}
                  >
                    <option value="new">New / Diagnosis</option>
                    <option value="update">Update / Start of Treatment</option>
                    <option value="final_outcome">Final Outcome</option>
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Facility Name">
                    <Input
                      placeholder="e.g., San Lazaro Hospital"
                      value={form.notification.facility_name}
                      onChange={(e) => updateSection("notification", "facility_name", e.target.value)}
                    />
                  </Field>
                  <Field label="NTP Facility Code">
                    <Input
                      placeholder="e.g., NTP-00123"
                      value={form.notification.ntp_facility_code}
                      onChange={(e) => updateSection("notification", "ntp_facility_code", e.target.value)}
                    />
                  </Field>
                  <Field label="Province / HUC">
                    <Input
                      placeholder="e.g., Metro Manila"
                      value={form.notification.province_huc}
                      onChange={(e) => updateSection("notification", "province_huc", e.target.value)}
                    />
                  </Field>
                  <Field label="Region">
                    <Input
                      placeholder="e.g., NCR"
                      value={form.notification.region}
                      onChange={(e) => updateSection("notification", "region", e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}

            {/* ══════════ STEP 2: DEMOGRAPHICS ══════════ */}
            {currentStep.id === "demographics" && (
              <>
                <SectionHeader icon={User} title="Patient Demographics" />
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Surname" required>
                    <Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
                  </Field>
                  <Field label="Given Name" required>
                    <Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
                  </Field>
                  <Field label="Middle Name">
                    <Input value={form.middle_name} onChange={(e) => update("middle_name", e.target.value)} />
                  </Field>
                  <Field label="Name Extension">
                    <Input
                      placeholder="Jr., III"
                      value={form.name_extension}
                      onChange={(e) => update("name_extension", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Date of Birth" required>
                    <Input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => update("date_of_birth", e.target.value)}
                    />
                  </Field>
                  <Field label="Sex" required>
                    <select
                      className={SELECT_CLASSES}
                      value={form.gender}
                      onChange={(e) => update("gender", e.target.value)}
                    >
                      <option value="">Select sex</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Civil Status">
                    <select
                      className={SELECT_CLASSES}
                      value={form.civil_status}
                      onChange={(e) => update("civil_status", e.target.value)}
                    >
                      <option value="">Select status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="widowed">Widowed</option>
                      <option value="separated">Separated</option>
                    </select>
                  </Field>
                </div>
                <Field label="Permanent Address" required>
                  <Input
                    placeholder="House No., Street, Barangay, City/Municipality, Province, Region, ZIP"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Nationality">
                    <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
                  </Field>
                  <Field label="PhilHealth Number">
                    <Input
                      placeholder="e.g., 12-3456789-0"
                      value={form.philhealth_number}
                      onChange={(e) => update("philhealth_number", e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}

            {/* ══════════ STEP 3: LABORATORY TESTS ══════════ */}
            {currentStep.id === "laboratory" && (
              <>
                <SectionHeader icon={FlaskConical} title="Laboratory Tests" />
                <p className="text-xs text-text-tertiary -mt-2">
                  Enter only tests that were performed. &quot;Not Available&quot; / &quot;Not Yet Done&quot; are allowed.
                </p>
                {form.laboratory_tests.length === 0 && (
                  <div className="rounded-[10px] border border-dashed border-border-default p-6 text-center">
                    <p className="text-sm text-text-tertiary">No laboratory tests added yet.</p>
                  </div>
                )}
                {form.laboratory_tests.map((test, idx) => (
                  <div key={idx} className="rounded-[12px] border border-border-light bg-bg-subtle/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="primary" size="sm">Test {idx + 1}</Badge>
                      <button
                        onClick={() =>
                          update(
                            "laboratory_tests",
                            form.laboratory_tests.filter((_, i) => i !== idx)
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-danger-bg hover:text-danger"
                        title="Remove test"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Test Type" required>
                        <select
                          className={SELECT_CLASSES}
                          value={test.test_type}
                          onChange={(e) => {
                            const tests = [...form.laboratory_tests];
                            tests[idx] = { ...test, test_type: e.target.value as LaboratoryTestType };
                            update("laboratory_tests", tests);
                          }}
                        >
                          {LAB_TEST_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </Field>
                      {test.test_type === "other" && (
                        <Field label="Specify Test">
                          <Input
                            value={test.test_name || ""}
                            onChange={(e) => {
                              const tests = [...form.laboratory_tests];
                              tests[idx] = { ...test, test_name: e.target.value };
                              update("laboratory_tests", tests);
                            }}
                          />
                        </Field>
                      )}
                      <Field label="Examination Date">
                        <Input
                          type="date"
                          value={test.test_date}
                          onChange={(e) => {
                            const tests = [...form.laboratory_tests];
                            tests[idx] = { ...test, test_date: e.target.value };
                            update("laboratory_tests", tests);
                          }}
                        />
                      </Field>
                      <Field label="Result / Reading">
                        <Input
                          placeholder="e.g., MTB Detected, Rifampicin resistance not detected"
                          value={test.result}
                          onChange={(e) => {
                            const tests = [...form.laboratory_tests];
                            tests[idx] = { ...test, result: e.target.value };
                            update("laboratory_tests", tests);
                          }}
                        />
                      </Field>
                      <Field label="Status">
                        <select
                          className={SELECT_CLASSES}
                          value={test.status}
                          onChange={(e) => {
                            const tests = [...form.laboratory_tests];
                            tests[idx] = { ...test, status: e.target.value as LaboratoryTestStatus };
                            update("laboratory_tests", tests);
                          }}
                        >
                          {LAB_TEST_STATUS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update("laboratory_tests", [...form.laboratory_tests, { ...EMPTY_LAB_TEST }])}
                >
                  <Plus className="h-4 w-4" />
                  Add Laboratory Test
                </Button>
              </>
            )}

            {/* ══════════ STEP 4: DIAGNOSIS ══════════ */}
            {currentStep.id === "diagnosis" && (
              <>
                <SectionHeader icon={Stethoscope} title="Diagnosis" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Diagnosis" required>
                    <select
                      className={SELECT_CLASSES}
                      value={form.diagnosis.diagnosis_type}
                      onChange={(e) => updateSection("diagnosis", "diagnosis_type", e.target.value)}
                    >
                      <option value="tb_disease">TB Disease</option>
                      <option value="tb_infection">TB Infection</option>
                    </select>
                  </Field>
                  <Field label="Date of Diagnosis" required>
                    <Input
                      type="date"
                      value={form.diagnosis.diagnosis_date}
                      onChange={(e) => updateSection("diagnosis", "diagnosis_date", e.target.value)}
                    />
                  </Field>
                  <Field label="Date of Notification">
                    <Input
                      type="date"
                      value={form.diagnosis.notification_date}
                      onChange={(e) => updateSection("diagnosis", "notification_date", e.target.value)}
                    />
                  </Field>
                  <Field label="TB / TPT Case Number">
                    <Input
                      value={form.diagnosis.case_number}
                      onChange={(e) => updateSection("diagnosis", "case_number", e.target.value)}
                    />
                  </Field>
                  <Field label="Attending Physician">
                    <Input
                      value={form.diagnosis.attending_physician}
                      onChange={(e) => updateSection("diagnosis", "attending_physician", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="pt-2">
                  <SectionHeader icon={Building2} title="Referral (if referred)" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Referring Name / Facility">
                      <Input
                        value={form.diagnosis.referral_name}
                        onChange={(e) => updateSection("diagnosis", "referral_name", e.target.value)}
                      />
                    </Field>
                    <Field label="Referral Facility Code">
                      <Input
                        value={form.diagnosis.referral_facility_code}
                        onChange={(e) => updateSection("diagnosis", "referral_facility_code", e.target.value)}
                      />
                    </Field>
                    <Field label="Referral Address">
                      <Input
                        value={form.diagnosis.referral_address}
                        onChange={(e) => updateSection("diagnosis", "referral_address", e.target.value)}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Province / HUC">
                        <Input
                          value={form.diagnosis.referral_province_huc}
                          onChange={(e) => updateSection("diagnosis", "referral_province_huc", e.target.value)}
                        />
                      </Field>
                      <Field label="Region">
                        <Input
                          value={form.diagnosis.referral_region}
                          onChange={(e) => updateSection("diagnosis", "referral_region", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══════════ STEP 5: CLASSIFICATION ══════════ */}
            {currentStep.id === "classification" && (
              <>
                <SectionHeader icon={Layers} title="TB Disease Classification" />
                <Field label="Bacteriological Status" required>
                  <RadioRow
                    name="bacteriological_status"
                    value={form.classification.bacteriological_status}
                    onChange={(v) => updateSection("classification", "bacteriological_status", v)}
                    options={[
                      { value: "bacteriologically_confirmed", label: "Bacteriologically-confirmed TB" },
                      { value: "clinically_diagnosed", label: "Clinically-diagnosed TB" },
                    ]}
                  />
                </Field>
                <Field label="Anatomical Site" required>
                  <RadioRow
                    name="anatomical_site"
                    value={form.classification.anatomical_site}
                    onChange={(v) => updateSection("classification", "anatomical_site", v)}
                    options={[
                      { value: "pulmonary", label: "Pulmonary" },
                      { value: "extrapulmonary", label: "Extra-pulmonary" },
                    ]}
                  />
                </Field>
                {form.classification.anatomical_site === "extrapulmonary" && (
                  <Field label="Specify Site" required>
                    <Input
                      placeholder="e.g., Lymph nodes, bones/joints, pleura"
                      value={form.classification.extrapulmonary_site}
                      onChange={(e) => updateSection("classification", "extrapulmonary_site", e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Drug Resistance Bacteriological Status" required>
                  <select
                    className={SELECT_CLASSES}
                    value={form.classification.drug_resistance_status}
                    onChange={(e) => updateSection("classification", "drug_resistance_status", e.target.value)}
                  >
                    <option value="drug_susceptible">Drug-susceptible</option>
                    <option value="bc_rr_tb">Bacteriologically-confirmed RR-TB</option>
                    <option value="bc_mdr_tb">Bacteriologically-confirmed MDR-TB</option>
                    <option value="bc_xdr_tb">Bacteriologically-confirmed XDR-TB</option>
                    <option value="cd_mdr_tb">Clinically-diagnosed MDR-TB</option>
                    <option value="other_dr_resistant">Other drug-resistant TB</option>
                  </select>
                </Field>
                <Field label="Registration Group" required>
                  <select
                    className={SELECT_CLASSES}
                    value={form.classification.registration_group}
                    onChange={(e) => updateSection("classification", "registration_group", e.target.value)}
                  >
                    <option value="new">New</option>
                    <option value="relapse">Relapse</option>
                    <option value="taf">TAF — Treatment After Failure</option>
                    <option value="tpt">TPT — TB Preventive Treatment</option>
                    <option value="talf">TALF — Treatment After Loss to Follow-up</option>
                    <option value="unknown_history">Unknown History</option>
                  </select>
                </Field>
              </>
            )}

            {/* ══════════ STEP 6: TREATMENT ══════════ */}
            {currentStep.id === "treatment" && (
              <>
                <SectionHeader icon={Pill} title="Treatment Information" />
                <p className="text-xs text-text-tertiary -mt-2 mb-2">
                  Record treatment start information. Outcome fields (regimen at end, treatment outcome, date of
                  outcome) are added later from the patient profile once treatment concludes.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Treatment Start Date" required>
                    <Input
                      type="date"
                      value={form.treatment.start_date}
                      onChange={(e) => updateSection("treatment", "start_date", e.target.value)}
                    />
                  </Field>
                  <Field label="Regimen Type at Start" required>
                    <select
                      className={SELECT_CLASSES}
                      value={form.treatment.regimen_type}
                      onChange={(e) => updateSection("treatment", "regimen_type", e.target.value)}
                    >
                      <option value="">Select starting regimen</option>
                      {REGIMEN_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea
                    className="flex min-h-[80px] w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
                    placeholder="Any treatment notes at registration..."
                    value={form.treatment.notes}
                    onChange={(e) => updateSection("treatment", "notes", e.target.value)}
                  />
                </Field>
              </>
            )}

            {/* ══════════ STEP 7: CLOSE CONTACTS ══════════ */}
            {currentStep.id === "contacts" && (
              <>
                <SectionHeader icon={Users} title="Close Contacts" />
                <p className="text-xs text-text-tertiary -mt-2 mb-2">
                  Optional — register known close contacts for screening.
                </p>
                {form.close_contacts.length === 0 && (
                  <div className="rounded-[10px] border border-dashed border-border-default p-6 text-center">
                    <p className="text-sm text-text-tertiary">No close contacts added yet.</p>
                  </div>
                )}
                {form.close_contacts.map((contact, idx) => (
                  <div key={idx} className="rounded-[12px] border border-border-light bg-bg-subtle/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="primary" size="sm">Contact {idx + 1}</Badge>
                      <button
                        onClick={() =>
                          update("close_contacts", form.close_contacts.filter((_, i) => i !== idx))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-danger-bg hover:text-danger"
                        title="Remove contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Contact Name" required>
                        <Input
                          value={contact.full_name}
                          onChange={(e) => {
                            const contacts = [...form.close_contacts];
                            contacts[idx] = { ...contact, full_name: e.target.value };
                            update("close_contacts", contacts);
                          }}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Age">
                          <Input
                            type="number"
                            min={0}
                            value={contact.age}
                            onChange={(e) => {
                              const contacts = [...form.close_contacts];
                              contacts[idx] = { ...contact, age: e.target.value };
                              update("close_contacts", contacts);
                            }}
                          />
                        </Field>
                        <Field label="Sex">
                          <select
                            className={SELECT_CLASSES}
                            value={contact.sex}
                            onChange={(e) => {
                              const contacts = [...form.close_contacts];
                              contacts[idx] = { ...contact, sex: e.target.value as CloseContactEntry["sex"] };
                              update("close_contacts", contacts);
                            }}
                          >
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Relationship">
                        <Input
                          placeholder="e.g., Spouse, Co-worker"
                          value={contact.relationship}
                          onChange={(e) => {
                            const contacts = [...form.close_contacts];
                            contacts[idx] = { ...contact, relationship: e.target.value };
                            update("close_contacts", contacts);
                          }}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Screening Date">
                          <Input
                            type="date"
                            value={contact.screening_date}
                            onChange={(e) => {
                              const contacts = [...form.close_contacts];
                              contacts[idx] = { ...contact, screening_date: e.target.value };
                              update("close_contacts", contacts);
                            }}
                          />
                        </Field>
                        <Field label="Follow-up Date">
                          <Input
                            type="date"
                            value={contact.followup_date}
                            onChange={(e) => {
                              const contacts = [...form.close_contacts];
                              contacts[idx] = { ...contact, followup_date: e.target.value };
                              update("close_contacts", contacts);
                            }}
                          />
                        </Field>
                      </div>
                      <Field label="Remarks / TB Case Number">
                        <Input
                          value={contact.remarks}
                          onChange={(e) => {
                            const contacts = [...form.close_contacts];
                            contacts[idx] = { ...contact, remarks: e.target.value };
                            update("close_contacts", contacts);
                          }}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update("close_contacts", [...form.close_contacts, { ...EMPTY_CONTACT }])}
                >
                  <Plus className="h-4 w-4" />
                  Add Close Contact
                </Button>
              </>
            )}

            {/* ══════════ STEP 8: REVIEW ══════════ */}
            {currentStep.id === "review" && (
              <>
                <SectionHeader icon={ClipboardCheck} title="Review Patient Information" />
                <div className="space-y-4">
                  <ReviewGroup title="Patient Information">
                    <ReviewRow label="Name" value={displayName} />
                    <ReviewRow label="Date of Birth" value={form.date_of_birth || "—"} />
                    <ReviewRow label="Sex" value={form.gender || "—"} />
                    <ReviewRow label="Civil Status" value={form.civil_status || "—"} />
                    <ReviewRow label="Nationality" value={form.nationality || "—"} />
                    <ReviewRow label="Address" value={form.address || "—"} />
                    <ReviewRow label="PhilHealth" value={form.philhealth_number || "—"} />
                  </ReviewGroup>
                  <ReviewGroup title="Account">
                    <ReviewRow label="Email" value={form.email || "—"} />
                    <ReviewRow label="Contact Number" value={form.contact_number || form.phone || "—"} />
                  </ReviewGroup>
                  <ReviewGroup title="Facility / Notification">
                    <ReviewRow label="Reason" value={form.notification.reason} />
                    <ReviewRow label="Facility" value={form.notification.facility_name || "—"} />
                    <ReviewRow label="NTP Code" value={form.notification.ntp_facility_code || "—"} />
                    <ReviewRow label="Province / HUC" value={form.notification.province_huc || "—"} />
                    <ReviewRow label="Region" value={form.notification.region || "—"} />
                  </ReviewGroup>
                  <ReviewGroup title="Laboratory Tests">
                    {form.laboratory_tests.length === 0 ? (
                      <ReviewRow label="Tests" value="None recorded" />
                    ) : (
                      form.laboratory_tests.map((t, i) => (
                        <ReviewRow
                          key={i}
                          label={t.test_type === "other" ? t.test_name || "Other" : LAB_TEST_TYPES.find((x) => x.value === t.test_type)?.label || t.test_type}
                          value={`${t.status === "done" ? t.result || "—" : t.status.replace(/_/g, " ")}${t.test_date ? ` · ${t.test_date}` : ""}`}
                        />
                      ))
                    )}
                  </ReviewGroup>
                  <ReviewGroup title="Diagnosis">
                    <ReviewRow label="Diagnosis" value={form.diagnosis.diagnosis_type === "tb_disease" ? "TB Disease" : "TB Infection"} />
                    <ReviewRow label="Date of Diagnosis" value={form.diagnosis.diagnosis_date || "—"} />
                    <ReviewRow label="Case Number" value={form.diagnosis.case_number || "—"} />
                    <ReviewRow label="Physician" value={form.diagnosis.attending_physician || "—"} />
                  </ReviewGroup>
                  <ReviewGroup title="TB Classification">
                    <ReviewRow label="Bacteriological Status" value={form.classification.bacteriological_status === "bacteriologically_confirmed" ? "Bacteriologically-confirmed" : "Clinically-diagnosed"} />
                    <ReviewRow
                      label="Anatomical Site"
                      value={form.classification.anatomical_site === "pulmonary" ? "Pulmonary" : `Extra-pulmonary — ${form.classification.extrapulmonary_site || "unspecified"}`}
                    />
                    <ReviewRow label="Drug Resistance" value={form.classification.drug_resistance_status.replace(/_/g, " ")} />
                    <ReviewRow label="Registration Group" value={form.classification.registration_group.replace(/_/g, " ")} />
                  </ReviewGroup>
                  <ReviewGroup title="Treatment">
                    <ReviewRow label="Start Date" value={form.treatment.start_date || "—"} />
                    <ReviewRow label="Regimen at Start" value={form.treatment.regimen_type || "—"} />
                    <ReviewRow label="Regimen at End" value="To be recorded after treatment" />
                    <ReviewRow label="Treatment Outcome" value="To be recorded after treatment" />
                  </ReviewGroup>
                  <ReviewGroup title="Close Contacts">
                    {form.close_contacts.length === 0 ? (
                      <ReviewRow label="Contacts" value="None registered" />
                    ) : (
                      form.close_contacts.map((c, i) => (
                        <ReviewRow key={i} label={c.full_name} value={[c.relationship, c.sex, c.age ? `Age ${c.age}` : ""].filter(Boolean).join(" · ") || "—"} />
                      ))
                    )}
                  </ReviewGroup>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Sticky footer ── */}
      <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-border-light shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={goPrev} disabled={stepIndex === 0 || submitting}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {stepIndex < STEPS.length - 1 ? (
            <Button onClick={goNext} disabled={submitting}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleRegister} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isResume ? "Completing..." : "Registering..."}
                </>
              ) : isResume ? (
                "Complete Registration"
              ) : (
                "Register Patient"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review helpers ───
function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border-light p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-tertiary shrink-0">{label}</span>
      <span className="text-text-primary text-right">{value}</span>
    </div>
  );
}
