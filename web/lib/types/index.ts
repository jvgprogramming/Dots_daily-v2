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

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

// ── Patient ──
export interface PatientProfile {
  id: number;
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
  email: string;
  phone?: string;
  password: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  occupation?: string;
  nationality?: string;
  health_id_number?: string;
  referred_by?: string;
}

export interface UpdatePatientPayload {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  occupation?: string;
  nationality?: string;
  health_id_number?: string;
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

// ── Navigation ──
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
