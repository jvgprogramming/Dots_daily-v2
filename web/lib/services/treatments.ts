import { api } from "./api";
import type {
  ApiResponse,
  TreatmentsData,
  TreatmentRecord,
  RescheduleFollowUpPayload,
  UpdateTreatmentPayload,
  UpdatedTreatmentRecord,
} from "@/lib/types";

export type TreatmentsStatusFilter =
  | "all"
  | "active"
  | "due_soon"
  | "rescheduled"
  | "completed";

export interface TreatmentsParams {
  /** Patient name / user name search. */
  search?: string;
  /** Filter chip: All | Active | Due Soon | Rescheduled | Completed. */
  status?: TreatmentsStatusFilter;
}

/**
 * Treatments hub — clinical operations data aggregated from live
 * treatment plans, medication logs, and the follow-up reschedule audit.
 */
export async function getTreatments(
  params?: TreatmentsParams
): Promise<ApiResponse<TreatmentsData>> {
  const searchParams: Record<string, string> = {};
  if (params?.search) searchParams.search = params.search;
  if (params?.status && params.status !== "all") searchParams.status = params.status;

  return api.get<ApiResponse<TreatmentsData>>("/treatments", {
    params: Object.keys(searchParams).length > 0 ? searchParams : undefined,
  });
}

/**
 * Treatment lifecycle update on the existing plan record — no duplicates.
 * Appends new lab tests as new entries; never rewrites intake data.
 */
export async function updateTreatment(
  planId: number,
  payload: UpdateTreatmentPayload
): Promise<ApiResponse<{ record: UpdatedTreatmentRecord }>> {
  return api.put<ApiResponse<{ record: UpdatedTreatmentRecord }>>(
    `/treatments/${planId}`,
    payload
  );
}

/**
 * Reschedule a follow-up for a treatment plan. Records an audit row with
 * the patient, plan, current date, reason, and new scheduled date.
 */
export async function rescheduleFollowUp(
  planId: number,
  payload: RescheduleFollowUpPayload
): Promise<ApiResponse<TreatmentRecord>> {
  return api.post<ApiResponse<TreatmentRecord>>(
    `/treatments/${planId}/reschedule-follow-up`,
    payload
  );
}
