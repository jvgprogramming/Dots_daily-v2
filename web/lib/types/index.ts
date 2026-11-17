// ── API Response ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

// ── Auth ──
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "staff" | "patient";
  profile_photo_url: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  patient: PatientProfile | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

// ── TB Registration ──
export type NotificationReason = "new" | "update" | "final_outcome";
export type LaboratoryTestType =
  | "xpert"
  | "xpert_ultra"
  | "smear"
  | "tb_lamp"
  | "cxr"
  | "tst"
  | "other";
export type LaboratoryTestStatus = "done" | "not_available" | "not_yet_done";
export type DiagnosisType = "tb_disease" | "tb_infection";
export type BacteriologicalStatus = "bacteriologically_confirmed" | "clinically_diagnosed";
export type AnatomicalSite = "pulmonary" | "extrapulmonary";
export type DrugResistanceStatus =
  | "drug_susceptible"
  | "bc_rr_tb"
  | "bc_mdr_tb"
  | "bc_xdr_tb"
  | "cd_mdr_tb"
  | "other_dr_resistant";
export type RegistrationGroup = "new" | "relapse" | "taf" | "tpt" | "talf" | "unknown_history";
export type PatientStatus = "draft" | "registered";

export interface NotificationSection {
  reason: NotificationReason;
  facility_name: string;
  ntp_facility_code: string;
  province_huc: string;
  region: string;
}

export interface LaboratoryTestEntry {
  test_type: LaboratoryTestType;
  test_name?: string;
  test_date: string;
  result: string;
  status: LaboratoryTestStatus;
  remarks?: string;
}

export interface DiagnosisSection {
  diagnosis_type: DiagnosisType;
  diagnosis_date: string;
  notification_date: string;
  case_number: string;
  attending_physician: string;
  referral_name: string;
  referral_address: string;
  referral_facility_code: string;
  referral_province_huc: string;
  referral_region: string;
}

export interface ClassificationSection {
  bacteriological_status: BacteriologicalStatus;
  anatomical_site: AnatomicalSite;
  extrapulmonary_site: string;
  drug_resistance_status: DrugResistanceStatus;
  registration_group: RegistrationGroup;
}

export interface TreatmentSection {
  start_date: string;
  regimen_type: string;
  notes: string;
}

export interface CloseContactEntry {
  full_name: string;
  age: string;
  sex: "" | "male" | "female";
  relationship: string;
  screening_date: string;
  followup_date: string;
  remarks: string;
}

export interface AccountSection {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface PatientRegistrationPayload {
  status: PatientStatus;
  name: string;
  email: string;
  phone: string;
  password: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  name_extension: string;
  date_of_birth: string;
  gender: string;
  civil_status: string;
  /** Baseline weight in kg at registration (weight-based dosing anchor). */
  weight_kg: string;
  nationality: string;
  address: string;
  contact_number: string;
  philhealth_number: string;
  notification: NotificationSection;
  laboratory_tests: LaboratoryTestEntry[];
  diagnosis: DiagnosisSection;
  classification: ClassificationSection;
  treatment: TreatmentSection;
  close_contacts: CloseContactEntry[];
}

// ── Patient ──
export interface TbNotification {
  id: number;
  reason: NotificationReason;
  facility_name: string | null;
  ntp_facility_code: string | null;
  province_huc: string | null;
  region: string | null;
}

export interface LaboratoryTestRecord {
  id: number;
  test_type: LaboratoryTestType;
  test_name: string | null;
  test_date: string | null;
  result: string | null;
  status: LaboratoryTestStatus;
  remarks: string | null;
}

export interface DiagnosisRecord {
  id: number;
  diagnosis_type: DiagnosisType;
  diagnosis_date: string | null;
  notification_date: string | null;
  case_number: string | null;
  attending_physician: string | null;
  referral_name: string | null;
  referral_address: string | null;
  referral_facility_code: string | null;
  referral_province_huc: string | null;
  referral_region: string | null;
}

export interface TbClassificationRecord {
  id: number;
  bacteriological_status: BacteriologicalStatus | null;
  anatomical_site: AnatomicalSite | null;
  extrapulmonary_site: string | null;
  drug_resistance_status: DrugResistanceStatus | null;
  registration_group: RegistrationGroup | null;
}

export interface CloseContactRecord {
  id: number;
  full_name: string;
  age: number | null;
  sex: string | null;
  relationship: string | null;
  screening_date: string | null;
  followup_date: string | null;
  remarks: string | null;
}

export interface PatientProfile {
  id: number;
  status?: PatientStatus;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  name_extension?: string | null;
  civil_status?: string | null;
  weight_kg?: string | number | null;
  philhealth_number?: string | null;
  draft_data?: Partial<PatientRegistrationPayload> | null;
  tb_notifications?: TbNotification[];
  laboratory_tests?: LaboratoryTestRecord[];
  diagnoses?: DiagnosisRecord[];
  tb_classification?: TbClassificationRecord[];
  close_contacts?: CloseContactRecord[];
  user_id?: number;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  occupation: string | null;
  nationality: string | null;
  health_id_number: string | null;
  referred_by: string | null;
  registered_by?: number;
  registered_at: string | null;
  created_at?: string;
  user?: AuthUser;
  treatment_plans_count?: number;
  medication_logs_count?: number;
  daily_monitoring_count?: number;
}

export interface PatientListItem {
  id: number;
  status?: PatientStatus;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  name_extension?: string | null;
  civil_status?: string | null;
  weight_kg?: string | number | null;
  philhealth_number?: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  occupation: string | null;
  nationality: string | null;
  health_id_number: string | null;
  referred_by: string | null;
  registered_at: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
  };
  registered_by_user?: {
    id: number;
    name: string;
  };
  treatment_plans_count?: number;
  medication_logs_count?: number;
  daily_monitoring_count?: number;
}

export interface CreatePatientPayload {
  name: string;
  status?: PatientStatus;
  email: string;
  phone?: string;
  password: string;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  name_extension?: string;
  date_of_birth?: string;
  gender?: string;
  civil_status?: string;
  weight_kg?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  occupation?: string;
  nationality?: string;
  health_id_number?: string;
  philhealth_number?: string;
  referred_by?: string;
}

export interface UpdatePatientPayload {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  name_extension?: string;
  date_of_birth?: string;
  gender?: string;
  civil_status?: string;
  weight_kg?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  occupation?: string;
  nationality?: string;
  health_id_number?: string;
  philhealth_number?: string;
  referred_by?: string;
}

export interface PatientDetailResponse {
  patient: PatientProfile;
  user: AuthUser;
  stats: {
    active_treatments: number;
    total_medication_logs: number;
    total_monitoring_sessions: number;
  };
  recent_activity: {
    treatment_plans: TreatmentPlan[];
    daily_monitoring: DailyMonitoring[];
    medication_logs: any[];
    symptom_logs: ISymptomLog[];
  };
}

/** A symptom a patient self-reported from the mobile app (recorded_by "patient"). */
export interface ISymptomLog {
  id: number;
  patient_id: number;
  recorded_date: string;
  symptom_type: string;
  /** Human label added by the API (e.g. "Yellow eyes or skin"). */
  label?: string;
  severity: "mild" | "moderate" | "severe";
  /** True when dangerous in itself or rated severe — surfaced to staff. */
  red_flag?: boolean;
  duration_hours?: number | null;
  notes?: string | null;
  recorded_by: string;
  created_at?: string;
}

export interface PatientSelectOption {
  id: number;
  name: string;
  email: string;
  health_id_number: string | null;
}

// ── Treatment Plan ──
export type TreatmentPlanStatus = "active" | "completed" | "discontinued" | "interrupted";
export type TreatmentOutcome = "cured" | "treatment_completed" | "died" | "failed" | "lost_to_followup";
export type TreatmentPhase = "intensive" | "continuation";

export interface TreatmentPlan {
  id: number;
  patient_id: number;
  patient?: PatientProfile;
  assigned_by?: number;
  plan_name: string;
  regimen_type?: string | null;
  regimen_type_end?: string | null;
  outcome?: TreatmentOutcome | string | null;
  outcome_date?: string | null;
  outcome_reason?: string | null;
  phase: "intensive" | "continuation" | "completed";
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  status: TreatmentPlanStatus | string;
  discontinuation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Treatment lifecycle update ──
export interface NewLabTestEntry {
  test_type: string;
  test_name?: string;
  test_date?: string;
  result?: string;
  status?: "done" | "not_available" | "not_yet_done";
  remarks?: string;
}

export interface UpdateTreatmentPayload {
  regimen_type?: string | null;
  regimen_type_end?: string | null;
  phase?: TreatmentPhase | null;
  status?: TreatmentPlanStatus | null;
  outcome?: TreatmentOutcome | null;
  outcome_date?: string | null;
  outcome_reason?: string | null;
  notes?: string | null;
  /** Appended as NEW laboratory test entries for the patient. */
  new_lab_tests?: NewLabTestEntry[];
}

export interface UpdatedTreatmentRecord extends TreatmentRecord {
  new_labs_count?: number;
}

// ── Medication ──
export type StorageCondition = "room_temperature" | "refrigerator" | "cold_storage" | "special";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "expired";

export interface Medication {
  id: number;
  name: string;
  generic_name: string;
  brand_name: string | null;
  dosage_form: string;
  strength: string;
  unit: string;
  description: string | null;
  is_active: boolean;
}

export interface MedicationInventoryItem {
  id: number;
  name: string;
  generic_name: string;
  brand_name: string | null;
  /** Dose presentation, e.g. "300mg capsule" — null for legacy medicines without one */
  dosage: string | null;
  quantity: number;
  reorder_level: number;
  unit: string;
  storage_condition: StorageCondition;
  expiry_date: string | null;
  stock_status: StockStatus;
  nearing_expiry: boolean;
  days_until_expiry: number | null;
  last_restocked_at: string | null;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface MedicationInventorySummary {
  total_medicines: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  expired: number;
  nearing_expiry: number;
  storage_breakdown: {
    room_temperature: number;
    refrigerator: number;
    cold_storage: number;
    special: number;
  };
}

export type StockMovementType = "initial" | "restock" | "deduction" | "correction";

export interface MedicationStockMovement {
  id: number;
  type: StockMovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  user: string | null;
  created_at: string;
}

export interface MedicationInventoryPayload {
  name: string;
  generic_name: string;
  brand_name?: string;
  dosage?: string;
  quantity: number;
  reorder_level?: number;
  /** Stock count unit (tablets, vials…) — NOT the dose unit (mg/g) */
  unit: string;
  storage_condition: StorageCondition;
  expiry_date?: string;
  notes?: string;
  /** Why the quantity changed — recorded in the stock movement ledger */
  stock_change_reason?: string;
}

// ── Daily Monitoring ──
export interface DailyMonitoring {
  id: number;
  patient_id: number;
  recorded_date: string;
  weight_kg: number | null;
  temperature_c: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  notes: string | null;
}

// ── Monitoring ──
export type AdherenceStatus = "taken" | "pending" | "missed" | "late" | "not_recorded";

export interface AdherenceDay {
  date: string;
  total_doses: number;
  taken: number;
  missed: number;
  late: number;
  /** Doses taken but not yet confirmed by a DOTS observer — "not verified". */
  pending: number;
  /** Doses taken and confirmed by a DOTS observer. */
  verified: number;
  daily_monitoring_recorded: boolean;
}

export interface MonitoringEntry {
  id: number;
  recorded_date: string;
  weight_kg: string | number | null;
  temperature_c: string | number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  notes: string | null;
}

export interface MonitoringPlanMedication {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  preferred_time: string | null;
}

// ── Calendar dose detail (right-side panel) ──
export type DoseLogStatus = "taken" | "late" | "missed" | "pending" | string;
export type ProofStatus = "provided" | "none";

export interface DoseLog {
  id: number;
  medication_id: number | null;
  medication_name: string;
  strength: string | null;
  dosage: string | null;
  dose_quantity: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  taken_at: string | null;
  status: DoseLogStatus;
  proof_status: ProofStatus;
  proof_url: string | null;
  patient_notes: string | null;
  plan_medication_notes: string | null;
  observed_by_name: string | null;
}

export interface MonitoringTreatmentPlan {
  id: number;
  plan_name: string;
  regimen_type: string | null;
  phase: string;
  status: string;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  discontinuation_reason: string | null;
  medications_count: number;
  medications: MonitoringPlanMedication[];
}

export type MonitoringRisk =
  | "on_track"
  | "watch"
  | "high_risk"
  | "overdue"
  | "interrupted"
  | "discontinued";

export interface MonitoringProgress {
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  phase: string;
  status: string;
  regimen_type: string | null;
  plan_name: string;
  total_days: number;
  days_elapsed: number;
  progress_pct: number;
  days_remaining: number;
  approaching_end: boolean;
  risk: MonitoringRisk;
}

export interface PatientMonitoringData {
  patient: {
    id: number;
    name: string;
    first_name: string | null;
    last_name: string | null;
    status: PatientStatus;
    active_treatments_count: number;
  };
  treatment_plan: MonitoringTreatmentPlan | null;
  adherence_by_date: AdherenceDay[];
  /** Dose-level logs for the selected calendar date (when `date` param sent). */
  dose_logs: DoseLog[];
  /** Recent medication history for the selected patient (History tab). */
  recent_history: DoseLog[];
  selected_date: string | null;
  monitoring_entries: MonitoringEntry[];
  /** Recent patient-reported symptoms (mobile Symptom Monitor), newest first. */
  symptom_logs: ISymptomLog[];
  summary: {
    adherence_rate: number | null;
    /** Days a dose was expected — the denominator behind adherence_rate. */
    scheduled_days: number;
    /** Days a dose was actually taken. */
    days_taken: number;
    total_doses: number;
    taken: number;
    missed: number;
    late: number;
    verified: number;
    pending: number;
    not_recorded_days: number;
    monitoring_entries_count: number;
  };
  progress: MonitoringProgress | null;
}

// ── Dashboard ──
export interface DashboardStat {
  title: string;
  value: number;
  change: string;
  patient_drafts?: number;
  change_note?: string;
  trend: "up" | "down" | "neutral";
}

export interface DashboardAdherencePoint {
  month: string;
  rate: number;
}

export interface DashboardActivityPoint {
  day: string;
  new: number;
  followups: number;
}

export interface DashboardDistributionItem {
  phase: string;
  key: string;
  color: string;
  count: number;
  percentage: number;
}

export interface DashboardRecentPatient {
  id: number;
  name: string;
  health_id_number: string | null;
  date: string | null;
  status: string;
}

export interface DashboardStatsData {
  stats: DashboardStat[];
  adherence_trend: DashboardAdherencePoint[];
  patient_activity: DashboardActivityPoint[];
  treatment_distribution: DashboardDistributionItem[];
  recent_patients: DashboardRecentPatient[];
  overview: {
    adherence_rate: number | null;
    treatment_success: number | null;
    follow_up_rate: number | null;
  };
  generated_at: string;
}

// ── Reports (medication adherence) ──
export type MedicationLogStatus = "taken" | "late" | "missed" | string;

export interface ReportMedicationLog {
  id: number;
  patient_id: number;
  patient_name: string;
  medication_name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: MedicationLogStatus;
  taken_at: string | null;
  dose_quantity: string | null;
  proof_photo: string | null;
  proof_url: string | null;
  /** Recorded proof video URL (the DOTS evidence the patient uploads). */
  proof_video_url: string | null;
  has_video: boolean;
  notes: string | null;
  observed_by_name: string | null;
  /** Confirmed by a DOTS observer (admin) — legacy, kept for compatibility. */
  verified: boolean;
  /** Logged-by-default review: true once a nurse flags the proof as suspicious. */
  flagged: boolean;
  flag_reason: string | null;
  flagged_by_name: string | null;
  /** Video-Observed Therapy review state; null for a non-VOT dose. */
  verification_status: VotDoseStatus | null;
  created_at: string | null;
}

export interface ReportOverview {
  total_doses: number;
  taken: number;
  missed: number;
  late: number;
  /** Treatment days with no medication log at all (derived from active plans) */
  unrecorded_days: number;
  adherence_rate: number | null;
  /** Days a dose was expected — the denominator behind adherence_rate. */
  scheduled_days: number;
  /** Days a dose was actually taken. */
  days_taken: number;
  doses_with_proof: number;
  proof_upload_rate: number | null;
  patients_with_logs: number;
  from: string;
  to: string;
}

export interface ReportTrendPoint {
  date: string;
  label: string;
  total: number;
  taken: number;
  late: number;
  missed: number;
  /** Patients expected to take a dose that day. */
  expected: number;
  rate: number | null;
}

export interface ReportPatientRow {
  id: number;
  name: string;
  status: string;
  total_doses: number;
  taken: number;
  missed: number;
  late: number;
  scheduled_days: number;
  days_taken: number;
  adherence_rate: number | null;
  last_dose_date: string | null;
  proof_uploads: number;
}

export interface RescheduledFollowUp {
  id: number;
  patient_id: number;
  patient_name: string;
  treatment_plan_id: number;
  plan_name: string | null;
  original_date: string;
  new_date: string;
  rescheduled_at: string;
  reason: string | null;
  notes: string | null;
  rescheduled_by_name: string | null;
}

export interface ReportsData {
  overview: ReportOverview;
  trend: ReportTrendPoint[];
  patients: ReportPatientRow[];
  recent_logs: ReportMedicationLog[];
  proof_uploads: ReportMedicationLog[];
  rescheduled_follow_ups: RescheduledFollowUp[];
  generated_at: string;
}

// ── Treatments hub ──
export type TreatmentsStatusFilter = "all" | "active" | "due_soon" | "rescheduled" | "completed";
export type TreatmentRecordStatus = "active" | "due_soon" | "rescheduled" | "completed" | "discontinued" | "interrupted";
export type FollowUpStatus = "scheduled" | "due" | "overdue" | "completed" | "none";

export interface TreatmentAdherence {
  rate: number | null;
  taken: number;
  late: number;
  missed: number;
  total: number;
}

export interface TreatmentRecord {
  id: number;
  patient_id: number;
  patient_name: string;
  plan_name: string;
  regimen_type: string | null;
  regimen_type_end: string | null;
  outcome: string | null;
  outcome_date: string | null;
  outcome_reason: string | null;
  notes: string | null;
  phase: string;
  status: "active" | "completed" | "discontinued" | "interrupted" | string;
  record_status: TreatmentRecordStatus;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  next_follow_up: string | null;
  next_follow_up_status: FollowUpStatus;
  last_reschedule: {
    id: number;
    original_date: string;
    new_date: string;
    reason: string | null;
    notes: string | null;
  } | null;
  adherence: TreatmentAdherence;
  medications_count: number;
}

export interface TreatmentsSummary {
  active_plans: number;
  due_follow_ups: number;
  overdue_follow_ups: number;
  rescheduled_cases: number;
  completed_plans: number;
  adherence_rate: number | null;
  total_records: number;
}

export interface TreatmentsData {
  summary: TreatmentsSummary;
  records: TreatmentRecord[];
  follow_ups: TreatmentRecord[];
}

export interface RescheduleFollowUpPayload {
  current_date: string;
  new_date: string;
  reason?: string;
  notes?: string;
}

// ── Global Search ──
export type GlobalSearchResultType =
  | "patient"
  | "treatment_plan"
  | "medication"
  | "monitoring_entry";

export interface GlobalSearchResultItem {
  type: GlobalSearchResultType;
  id: number;
  patient_id?: number;
  title: string;
  subtitle: string | null;
  meta: string | null;
  status: string | null;
}

export interface GlobalSearchData {
  query: string;
  patients: GlobalSearchResultItem[];
  treatment_plans: GlobalSearchResultItem[];
  medications: GlobalSearchResultItem[];
  monitoring_entries: GlobalSearchResultItem[];
  totals: {
    patients: number;
    treatment_plans: number;
    medications: number;
    monitoring_entries: number;
    all: number;
  };
}

// ── Settings ──
export type SettingsGroup =
  | "facility"
  | "clinical"
  | "protocols"
  | "inventory"
  | "notifications"
  | "reports"
  | "security"
  | "vot";
export type StaffRole = "admin" | "staff";
export type SettingsModule =
  | "patients"
  | "treatments"
  | "monitoring"
  | "medications"
  | "reports"
  | "settings";

export interface SettingEntry {
  value: string;
  updated_at: string | null;
  updated_by_name: string | null;
}

export interface SettingsData {
  settings: Record<SettingsGroup, Record<string, SettingEntry>>;
  modules: SettingsModule[];
}

/** A TB regimen configured in Settings → Treatment protocols. */
export interface RegimenProtocol {
  code: string;
  name: string;
  intensive_days: number;
  continuation_days: number;
  drugs: string;
}

/** Adult FDC tablet counts per body-weight band. */
export interface WeightBand {
  min_kg: number;
  max_kg: number | null;
  intensive_tablets: number;
  continuation_tablets: number;
}

/** GET /settings/public — values any portal user's screens depend on. */
export interface PublicSettings {
  facility_name: string;
  clinic_schedule: string;
  late_dose_threshold_minutes: number;
  adherence_calculation: "taken_plus_late" | "taken_only";
  risk_watch_below: number;
  risk_high_below: number;
  regimens: RegimenProtocol[];
  weight_bands: WeightBand[];
  outcome_options: string[];
  low_stock_default: number;
  near_expiry_days: number;
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  permissions: SettingsModule[] | null;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
}

export interface CreateStaffUserPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: StaffRole;
  is_active?: boolean;
}

export interface UpdateStaffUserPayload {
  name?: string;
  phone?: string;
  password?: string;
  role?: StaffRole;
  is_active?: boolean;
}

export type AuditArea =
  | "all"
  | "logins"
  | "failed_logins"
  | "auth"
  | "patients"
  | "treatments"
  | "doses"
  | "medications"
  | "users"
  | "settings";

export interface AuditChange {
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  id: number;
  user_name: string;
  action: string;
  description: string | null;
  subject_type: string | null;
  subject_id: number | null;
  properties: ({ changes?: Record<string, AuditChange> } & Record<string, unknown>) | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
}

export interface AuditFilters {
  area?: AuditArea;
  user_id?: number | "";
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface AuditData {
  entries: AuditEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  areas: string[];
  staff: { id: number; name: string }[];
  audit_logging_enabled: boolean;
}

export interface LoginActivityRow {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  failed_attempts_24h: number;
  active_sessions: number;
}

export interface LoginActivityData {
  users: LoginActivityRow[];
  failed_logins_24h: number;
  unknown_email_attempts_24h: number;
}

// ── Staff notifications ──
export interface StaffNotification {
  id: number;
  type: "missed_dose_escalation" | "followup_reminder" | string;
  title: string;
  body: string;
  data: { patient_id?: number; link?: string } & Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export interface StaffNotificationsData {
  notifications: StaffNotification[];
  unread_count: number;
  meta: { current_page: number; last_page: number; total: number };
}

// ── Navigation ──
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

// ── Video-Observed Therapy ──

/** A dose's VOT review state (medication_logs.verification_status). */
export type VotDoseStatus =
  | "awaiting_proof"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmission_required";

/** One proof attempt's review state. */
export type VotSubmissionStatus = "pending" | "verified" | "rejected" | "resubmission_requested";

export type VotEnrollmentStatus = "active" | "suspended" | "revoked";

export interface IVotEnrollment {
  id: number;
  patient_id: number;
  status: VotEnrollmentStatus;
  is_active: boolean;
  eligible_since: string | null;
  assigned_nurse_id: number | null;
  assigned_nurse_name: string | null;
  granted_by_name: string | null;
  notes: string | null;
  status_reason: string | null;
  status_changed_at: string | null;
  status_changed_by_name: string | null;
  updated_at: string | null;
}

export interface IVotEnrollmentPayload {
  status: VotEnrollmentStatus;
  eligible_since?: string | null;
  assigned_nurse_id?: number | null;
  notes?: string | null;
  status_reason?: string | null;
}

export interface IVotNurse {
  id: number;
  name: string;
  role: StaffRole;
}

export interface IVotSummary {
  total_submissions: number;
  pending: number;
  verified: number;
  rejected: number;
  resubmission_requested: number;
  enrolled_patients: number;
}

export interface IVotSubmission {
  id: number;
  attempt: number;
  status: VotSubmissionStatus;
  media_type: "video" | "photo";
  media_mime: string | null;
  media_size: number | null;
  duration_seconds: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_reason: string | null;
  /** Signed, short-lived link — only on the detail endpoint. */
  media_url?: string;
  patient: {
    id: number;
    name: string;
    health_id_number: string | null;
    assigned_nurse_name: string | null;
  };
  treatment: {
    id: number;
    plan_name: string | null;
    regimen_type: string | null;
    phase: string | null;
    status: string | null;
  } | null;
  dose: {
    medication_log_id: number;
    medication_name: string | null;
    dosage: string | null;
    dose_quantity: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    taken_at: string | null;
    dose_status: string | null;
    verification_status: VotDoseStatus | null;
  };
}

export interface IVotSubmissionAttempt {
  id: number;
  attempt: number;
  status: VotSubmissionStatus;
  media_type: "video" | "photo";
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_reason: string | null;
}

export interface IVotSubmissionDetail extends IVotSubmission {
  media_url: string;
  history: IVotSubmissionAttempt[];
}

export interface IVotSubmissionFilters {
  search?: string;
  patient_id?: number;
  status?: VotSubmissionStatus;
  nurse_id?: number;
  treatment_status?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export type VotReviewAction = "verify" | "reject" | "request-resubmission";
