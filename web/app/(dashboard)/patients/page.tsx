"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Search,
  Plus,
  Phone,
  Edit3,
  Trash2,
  Loader2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { PatientRegistrationWizard } from "@/components/features/patients/PatientRegistrationWizard";
import { PatientProfileModal } from "@/components/features/patients/PatientProfileModal";
import type { PatientRegistrationPayload } from "@/lib/types";
import { getPatient } from "@/lib/services/patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { motion } from "framer-motion";
import {
  getPatients,
  updatePatient,
  deletePatient,
  type PatientListParams,
} from "@/lib/services/patients";
import type {
  PatientListItem,
  CreatePatientPayload,
  UpdatePatientPayload,
  PaginatedResponse,
} from "@/lib/types";

// ─── Wizard state ───
interface WizardState {
  open: boolean;
  draft: { patientId: number; payload: Partial<PatientRegistrationPayload> } | null;
}

// ─── Profile modal state ───
interface ProfileState {
  open: boolean;
  patientId: number | null;
}

// ─── Gender options ───
const genderOptions = [
  { value: "", label: "All genders" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

// ─── Empty state for a blank patient form ───
const emptyForm: CreatePatientPayload = {
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
  weight_kg: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  occupation: "",
  nationality: "",
  health_id_number: "",
  philhealth_number: "",
  referred_by: "",
};

// ─── Format date for display ───
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function PatientsPage() {
  // ── State ──
  const [patients, setPatients] = useState<PaginatedResponse<PatientListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & filters
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [search, setSearch] = useState(urlQuery);
  const [searchInput, setSearchInput] = useState(urlQuery);
  const [genderFilter, setGenderFilter] = useState("");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | "detail" | "delete" | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [formData, setFormData] = useState<CreatePatientPayload>({ ...emptyForm });

  // Wizard state (registration) — separate from the edit modal
  const [wizard, setWizard] = useState<WizardState>({ open: false, draft: null });
  const [wizardKey, setWizardKey] = useState(0); // remount to reset wizard state

  // Profile modal state
  const [profile, setProfile] = useState<ProfileState>({ open: false, patientId: null });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // ── Fetch patients ──
  const fetchPatients = useCallback(async (params: PatientListParams = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await getPatients({
        page: params.page ?? page,
        search: params.search ?? search,
        gender: params.gender ?? genderFilter,
        per_page: 10,
        sort_by: "created_at",
        sort_dir: "desc",
      });
      setPatients(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [page, search, genderFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Sync when arriving with ?q= from the header global search
  useEffect(() => {
    setSearch(urlQuery);
    setSearchInput(urlQuery);
    setPage(1);
  }, [urlQuery]);

  // ── Search debounce ──
  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  // ── Gender filter ──
  const handleGenderChange = (value: string) => {
    setGenderFilter(value);
    setPage(1);
  };

  // ── Open registration wizard (fresh) ──
  const openAddModal = () => {
    setWizardKey((k) => k + 1);
    setWizard({ open: true, draft: null });
  };

  // ── Resume a draft registration ──
  const resumeDraft = async (patient: PatientListItem) => {
    setFormError("");
    try {
      const res = await getPatient(patient.id);
      const draftData = (res.data?.patient as { draft_data?: Partial<PatientRegistrationPayload> } | undefined)?.draft_data;
      if (!draftData) {
        setFormError("This draft has no saved form data to resume.");
        return;
      }
      setWizardKey((k) => k + 1);
      setWizard({ open: true, draft: { patientId: patient.id, payload: draftData } });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to load draft");
    }
  };

  // ── Open edit modal ──
  const openEditModal = (patient: PatientListItem) => {
    setSelectedPatient(patient);
    setFormData({
      name: patient.user?.name || [patient.first_name, patient.last_name].filter(Boolean).join(" "),
      email: patient.user?.email || "",
      phone: patient.user?.phone || "",
      password: "",
      last_name: patient.last_name || "",
      first_name: patient.first_name || "",
      middle_name: patient.middle_name || "",
      name_extension: patient.name_extension || "",
      date_of_birth: patient.date_of_birth || "",
      gender: patient.gender || "",
      civil_status: patient.civil_status || "",
      weight_kg: patient.weight_kg != null ? String(patient.weight_kg) : "",
      address: patient.address || "",
      emergency_contact_name: patient.emergency_contact_name || "",
      emergency_contact_phone: patient.emergency_contact_phone || "",
      occupation: patient.occupation || "",
      nationality: patient.nationality || "",
      health_id_number: patient.health_id_number || "",
      philhealth_number: patient.philhealth_number || "",
      referred_by: patient.referred_by || "",
    });
    setFormError("");
    setFormSuccess("");
    setModalMode("edit");
  };

  // ── Open profile modal (loads full registration data) ──
  const openDetailModal = (patient: PatientListItem) => {
    setProfile({ open: true, patientId: patient.id });
  };

  // ── Open delete modal ──
  const openDeleteModal = (patient: PatientListItem) => {
    setSelectedPatient(patient);
    setFormError("");
    setFormSuccess("");
    setModalMode("delete");
  };

  // ── Handle form submit ──
  const handleSubmit = async () => {
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);

    try {
      if (modalMode === "edit" && selectedPatient) {
        const payload: UpdatePatientPayload = { ...formData };
        if (!payload.password) delete payload.password;
        await updatePatient(selectedPatient.id, payload);
        setFormSuccess("Patient updated successfully.");
      }

      // Refresh list after a short delay
      setTimeout(() => {
        setModalMode(null);
        fetchPatients();
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handle delete ──
  const handleDelete = async () => {
    if (!selectedPatient) return;
    setFormError("");
    setFormSuccess("");
    setSubmitting(true);

    try {
      await deletePatient(selectedPatient.id);
      setFormSuccess("Patient deleted successfully.");
      setTimeout(() => {
        setModalMode(null);
        fetchPatients();
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Form field handler ──
  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ── Gender badge color ──
  const genderBadge = (gender: string | null | undefined) => {
    switch (gender) {
      case "male": return { label: "Male", variant: "info" as const };
      case "female": return { label: "Female", variant: "primary" as const };
      case "other": return { label: "Other", variant: "outline" as const };
      default: return { label: "—", variant: "outline" as const };
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
            Patients
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage patient registrations and profiles.
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          Add Patient
        </Button>
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Search by name, email, phone, or health ID..."
              className="pl-9 h-10 rounded-[8px]"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSearch} className="shrink-0">
            Search
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary font-medium">Gender:</span>
          <div className="flex gap-1">
            {genderOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleGenderChange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all duration-150 ${
                  genderFilter === opt.value
                    ? "bg-primary-500 text-white"
                    : "bg-bg-subtle text-text-secondary hover:bg-border-light"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error State ── */}
      {error && (
        <Alert variant="danger" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* ── Table / Loading / Empty ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[12px] border border-border-light p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
                <Skeleton className="h-8 w-20 rounded-[6px]" />
              </div>
            </div>
          ))}
        </div>
      ) : patients && patients.data.length > 0 ? (
        <>
          {/* ── Table ── */}
          <div className="rounded-[12px] border border-border-light bg-bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-light bg-bg-subtle/50">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Patient
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary hidden sm:table-cell">
                      Contact
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary hidden md:table-cell">
                      Gender
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary hidden lg:table-cell">
                      Health ID
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary hidden lg:table-cell">
                      Registered
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light/50">
                  {patients.data.map((patient, i) => {
                    const gender = genderBadge(patient.gender);
                    return (
                      <motion.tr
                        key={patient.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="group hover:bg-bg-subtle/30 transition-colors cursor-pointer"
                        onClick={() => openDetailModal(patient)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-primary-50 text-primary-600 text-sm font-semibold">
                              {patient.user?.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-text-primary truncate">
                                  {patient.first_name
                                    ? `${patient.first_name} ${patient.last_name}`
                                    : patient.user?.name || "Unknown"}
                                  {patient.status === "draft" && (
                                    <Badge variant="warning" size="sm" className="ml-2">
                                      Draft
                                    </Badge>
                                  )}
                                </p>
                              </div>
                              <p className="text-xs text-text-tertiary truncate">
                                {patient.user?.email || (patient.status === "draft" ? "No account yet" : "No email")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          <div className="space-y-0.5">
                            {patient.user?.phone && (
                              <p className="text-sm text-text-secondary flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-text-tertiary" />
                                {patient.user.phone}
                              </p>
                            )}
                            {!patient.user?.phone && (
                              <p className="text-sm text-text-tertiary">No phone</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <Badge variant={gender.variant} size="sm">
                            {gender.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <span className="text-sm text-text-secondary">
                            {patient.health_id_number || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell">
                          <span className="text-sm text-text-secondary">
                            {formatDate(patient.registered_at)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {patient.status === "draft" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); resumeDraft(patient); }}
                                className="flex h-8 items-center justify-center rounded-[6px] px-2 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-all"
                                title="Resume draft registration"
                              >
                                Resume
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(patient); }}
                              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-all"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openDeleteModal(patient); }}
                              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-text-tertiary hover:bg-danger-bg hover:text-danger transition-all"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-tertiary">
              Showing {patients.meta.from}–{patients.meta.to} of {patients.meta.total} patients
            </p>
            <Pagination
              currentPage={patients.meta.current_page}
              totalPages={patients.meta.last_page}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No patients found"
          description={
            search || genderFilter
              ? "Try adjusting your search or filters."
              : "Get started by registering your first patient."
          }
          action={
            !search && !genderFilter
              ? { label: "Add Patient", onClick: openAddModal }
              : undefined
          }
        />
      )}

      {/* ── REGISTRATION WIZARD ── */}
      <Modal
        open={wizard.open}
        onClose={() => setWizard({ open: false, draft: null })}
        title={wizard.draft ? "Complete Patient Registration" : "Register New Patient"}
        description={
          wizard.draft
            ? "Resume the saved draft and complete the TB registration."
            : "Complete the digital TB/DOTS registration form — the patient's baseline record."
        }
        size="xl"
      >
        <PatientRegistrationWizard
          key={wizardKey}
          open={wizard.open}
          onClose={() => setWizard({ open: false, draft: null })}
          draft={wizard.draft}
          onSaved={(msg) => {
            setWizard({ open: false, draft: null });
            setFormSuccess(msg);
            fetchPatients();
          }}
        />
      </Modal>

      {/* ── ADD / EDIT MODAL ── */}
      <Modal
        open={modalMode === "edit"}
        onClose={() => setModalMode(null)}
        title="Edit Patient"
        description="Update patient information."
        size="lg"
      >
        <div className="flex flex-col" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {formError && <Alert variant="danger">{formError}</Alert>}
          {formSuccess && <Alert variant="success">{formSuccess}</Alert>}

          {/* ── Scrollable form body ── */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
            {/* Locked registration notice — clinical fields are managed via the registration record */}
            <div className="flex items-start gap-3 rounded-[10px] bg-info-bg p-4">
              <Lock className="h-4 w-4 text-info-text mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-info-text">
                  Only personal and account information can be edited here.
                </p>
                <p className="text-xs text-info-text/80 mt-0.5">
                  Notification, diagnosis, TB classification, laboratory results, treatment regimen and close contacts
                  are part of the official registration record — they are locked after submission and shown on the
                  patient profile.
                </p>
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-0.5 w-4 rounded-full bg-primary-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Basic Information
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    Full Name <span className="text-text-tertiary font-normal">(last name and given name required)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Surname *"
                      value={formData.last_name || ""}
                      onChange={(e) => updateField("last_name", e.target.value)}
                    />
                    <Input
                      placeholder="Given Name *"
                      value={formData.first_name || ""}
                      onChange={(e) => updateField("first_name", e.target.value)}
                    />
                    <Input
                      placeholder="Middle Name"
                      value={formData.middle_name || ""}
                      onChange={(e) => updateField("middle_name", e.target.value)}
                    />
                    <Input
                      placeholder="Extension (Jr., III)"
                      value={formData.name_extension || ""}
                      onChange={(e) => updateField("name_extension", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Email *</label>
                  <Input
                    type="email"
                    placeholder="juan@example.com"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Phone</label>
                  <Input
                    type="tel"
                    placeholder="+63 912 345 6789"
                    value={formData.phone || ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    New Password <span className="text-text-tertiary font-normal">(blank = keep current)</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Medical Profile */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-0.5 w-4 rounded-full bg-primary-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Medical Profile
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Date of Birth</label>
                  <Input
                    type="date"
                    value={formData.date_of_birth || ""}
                    onChange={(e) => updateField("date_of_birth", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Sex</label>
                  <select
                    className="flex h-11 w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
                    value={formData.gender || ""}
                    onChange={(e) => updateField("gender", e.target.value)}
                  >
                    <option value="">Select sex</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Civil Status</label>
                  <select
                    className="flex h-11 w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
                    value={formData.civil_status || ""}
                    onChange={(e) => updateField("civil_status", e.target.value)}
                  >
                    <option value="">Select status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="widowed">Widowed</option>
                    <option value="separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Weight (kg)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="1"
                    max="500"
                    placeholder="e.g., 54.5"
                    value={formData.weight_kg || ""}
                    onChange={(e) => updateField("weight_kg", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Address</label>
                  <Input
                    placeholder="Full address"
                    value={formData.address || ""}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Occupation</label>
                  <Input
                    placeholder="e.g., Teacher"
                    value={formData.occupation || ""}
                    onChange={(e) => updateField("occupation", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Nationality</label>
                  <Input
                    placeholder="e.g., Filipino"
                    value={formData.nationality || ""}
                    onChange={(e) => updateField("nationality", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Health ID</label>
                  <Input
                    placeholder="Government/PHIC ID"
                    value={formData.health_id_number || ""}
                    onChange={(e) => updateField("health_id_number", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">PhilHealth Number</label>
                  <Input
                    placeholder="e.g., 12-3456789-0"
                    value={formData.philhealth_number || ""}
                    onChange={(e) => updateField("philhealth_number", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Referred By</label>
                  <Input
                    placeholder="Referral source"
                    value={formData.referred_by || ""}
                    onChange={(e) => updateField("referred_by", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="pb-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-0.5 w-4 rounded-full bg-primary-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Emergency Contact
                </h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Contact Name</label>
                  <Input
                    placeholder="Emergency contact person"
                    value={formData.emergency_contact_name || ""}
                    onChange={(e) => updateField("emergency_contact_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Contact Phone</label>
                  <Input
                    type="tel"
                    placeholder="Emergency contact number"
                    value={formData.emergency_contact_phone || ""}
                    onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Sticky footer ── */}
          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-border-light shrink-0">
            <Button variant="outline" onClick={() => setModalMode(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !!formSuccess}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── PATIENT PROFILE MODAL ── */}
      <PatientProfileModal
        open={profile.open}
        patientId={profile.patientId}
        onClose={() => setProfile({ open: false, patientId: null })}
        onEdit={(id) => {
          setProfile({ open: false, patientId: null });
          const target = patients?.data.find((pt) => pt.id === id);
          if (target) openEditModal(target);
        }}
        onResumeDraft={(id) => {
          setProfile({ open: false, patientId: null });
          const target = patients?.data.find((pt) => pt.id === id);
          if (target) resumeDraft(target);
          else {
            // Not on the current page of the list — fetch directly
            setProfile({ open: false, patientId: null });
            getPatient(id)
              .then((res) => {
                const dd = (res.data?.patient as { draft_data?: Partial<PatientRegistrationPayload> } | undefined)?.draft_data;
                if (dd) {
                  setWizardKey((k) => k + 1);
                  setWizard({ open: true, draft: { patientId: id, payload: dd } });
                } else {
                  setFormError("This draft has no saved form data to resume.");
                }
              })
              .catch(() => setFormError("Failed to load draft."));
          }
        }}
      />

      {/* ── DELETE CONFIRMATION ── */}
      <Modal
        open={modalMode === "delete"}
        onClose={() => setModalMode(null)}
        title="Delete Patient"
        description="This action cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}
          {formSuccess && <Alert variant="success">{formSuccess}</Alert>}

          {!formSuccess && (
            <>
              <div className="flex items-center gap-3 rounded-[10px] bg-danger-bg p-4">
                <AlertCircle className="h-5 w-5 text-danger shrink-0" />
                <div>
                  <p className="text-sm font-medium text-danger-text">
                    Are you sure you want to delete this patient?
                  </p>
                  <p className="text-xs text-danger-text/80 mt-0.5">
                    {selectedPatient?.first_name
                      ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
                      : selectedPatient?.user?.name}{' '}
                    ({selectedPatient?.user?.email || 'no account'})
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setModalMode(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Patient"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
