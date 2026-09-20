import { api } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  PatientListItem,
  PatientDetailResponse,
  CreatePatientPayload,
  UpdatePatientPayload,
  PatientSelectOption,
} from "@/lib/types";

export interface PatientListParams {
  page?: number;
  per_page?: number;
  search?: string;
  gender?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
}

export async function getPatients(params?: PatientListParams): Promise<PaginatedResponse<PatientListItem>> {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.per_page) searchParams.per_page = String(params.per_page);
  if (params?.search) searchParams.search = params.search;
  if (params?.gender) searchParams.gender = params.gender;
  if (params?.date_from) searchParams.date_from = params.date_from;
  if (params?.date_to) searchParams.date_to = params.date_to;
  if (params?.sort_by) searchParams.sort_by = params.sort_by;
  if (params?.sort_dir) searchParams.sort_dir = params.sort_dir;

  return api.get<PaginatedResponse<PatientListItem>>("/patients", {
    params: Object.keys(searchParams).length > 0 ? searchParams : undefined,
  });
}

export async function getPatient(id: number): Promise<ApiResponse<PatientDetailResponse>> {
  return api.get<ApiResponse<PatientDetailResponse>>(`/patients/${id}`);
}

export async function createPatient(payload: CreatePatientPayload): Promise<ApiResponse> {
  return api.post<ApiResponse>("/patients", payload);
}

export async function updatePatient(id: number, payload: UpdatePatientPayload): Promise<ApiResponse> {
  return api.put<ApiResponse>(`/patients/${id}`, payload);
}

export async function deletePatient(id: number): Promise<ApiResponse> {
  return api.delete<ApiResponse>(`/patients/${id}`);
}

export async function getPatientList(search?: string): Promise<ApiResponse<PatientSelectOption[]>> {
  return api.get<ApiResponse<PatientSelectOption[]>>("/patients/list", {
    params: search ? { search } : undefined,
  });
}
