import { api } from "./api";
import type {
  ApiResponse,
  IVotEnrollment,
  IVotEnrollmentPayload,
  IVotNurse,
  IVotSubmission,
  IVotSubmissionDetail,
  IVotSubmissionFilters,
  IVotSummary,
  PaginatedResponse,
  VotReviewAction,
} from "@/lib/types";

/**
 * Video-Observed Therapy — the nurse's review queue (Reports → VOT) and a
 * patient's VOT eligibility. Media links come back signed and short-lived;
 * never store or share them.
 */

export async function getVotSummary(): Promise<ApiResponse<IVotSummary>> {
  return api.get<ApiResponse<IVotSummary>>("/vot/summary");
}

export async function getVotSubmissions(
  filters: IVotSubmissionFilters = {}
): Promise<PaginatedResponse<IVotSubmission>> {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  });
  return api.get<PaginatedResponse<IVotSubmission>>("/vot/submissions", { params });
}

/** Detail + a fresh signed media link. Each call is recorded in the audit log. */
export async function getVotSubmission(id: number): Promise<ApiResponse<IVotSubmissionDetail>> {
  return api.get<ApiResponse<IVotSubmissionDetail>>(`/vot/submissions/${id}`);
}

/** Verify (reason optional) or reject / request new proof (reason required). */
export async function reviewVotSubmission(
  id: number,
  action: VotReviewAction,
  reason?: string
): Promise<ApiResponse<IVotSubmission>> {
  return api.post<ApiResponse<IVotSubmission>>(
    `/vot/submissions/${id}/${action}`,
    reason ? { reason } : undefined
  );
}

export async function getVotNurses(): Promise<ApiResponse<IVotNurse[]>> {
  return api.get<ApiResponse<IVotNurse[]>>("/vot/nurses");
}

/** Null data when the patient has never been assessed for VOT. */
export async function getVotEnrollment(patientId: number): Promise<ApiResponse<IVotEnrollment | null>> {
  return api.get<ApiResponse<IVotEnrollment | null>>(`/patients/${patientId}/vot-enrollment`);
}

export async function updateVotEnrollment(
  patientId: number,
  payload: IVotEnrollmentPayload
): Promise<ApiResponse<IVotEnrollment>> {
  return api.put<ApiResponse<IVotEnrollment>>(`/patients/${patientId}/vot-enrollment`, payload);
}
