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
  role: "admin" | "patient";
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
    symptom_logs: any[];
  };
}

export interface PatientSelectOption {
  id: number;
  name: string;
  email: string;
  health_id_number: string | null;
}

// ── Treatment Plan ──
export interface TreatmentPlan {
  id: number;
  patient_id: number;
  patient?: PatientProfile;
  assigned_by?: number;
  plan_name: string;
  regimen_type?: string | null;
  regimen_type_end?: string | null;
  outcome?: string | null;
  outcome_date?: string | null;
  outcome_reason?: string | null;
  phase: "intensive" | "continuation" | "completed";
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  status: "active" | "completed" | "discontinued" | "interrupted";
  discontinuation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Medication ──
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
export type AdherenceStatus = "taken" | "missed" | "late" | "not_recorded";

export interface AdherenceDay {
  date: string;
  total_doses: number;
  taken: number;
  missed: number;
  late: number;
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
  monitoring_entries: MonitoringEntry[];
  summary: {
    adherence_rate: number | null;
    total_doses: number;
    taken: number;
    missed: number;
    late: number;
    not_recorded_days: number;
    monitoring_entries_count: number;
  };
  progress: MonitoringProgress | null;
}

// ── Navigation ──
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
