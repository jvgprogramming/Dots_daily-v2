import { api } from "./api";
import type {
  ApiResponse,
  DashboardStatsData,
  ReportMedicationLog,
  ReportsData,
} from "@/lib/types";

/**
 * Live dashboard statistics aggregated from the database:
 * KPI cards, adherence trend, patient activity, treatment
 * phase distribution, recent registrations, and overview metrics.
 */
export async function getDashboardStats(): Promise<ApiResponse<DashboardStatsData>> {
  return api.get<ApiResponse<DashboardStatsData>>("/dashboard/stats");
}

export interface MedicationReportsParams {
  /** ISO date (YYYY-MM-DD). Defaults to 30 days ago. */
  from?: string;
  /** ISO date (YYYY-MM-DD). Defaults to today. */
  to?: string;
  /** Optional patient filter. */
  patient_id?: number;
}

/**
 * Admin medication adherence reports — aggregated from live
 * medication logs (mobile dose confirmations + proof photos).
 */
export async function getMedicationReports(
  params?: MedicationReportsParams
): Promise<ApiResponse<ReportsData>> {
  const searchParams: Record<string, string> = {};
  if (params?.from) searchParams.from = params.from;
  if (params?.to) searchParams.to = params.to;
  if (params?.patient_id) searchParams.patient_id = String(params.patient_id);

  return api.get<ApiResponse<ReportsData>>("/reports/medication-adherence", {
    params: Object.keys(searchParams).length > 0 ? searchParams : undefined,
  });
}

/**
 * Confirm a patient's logged dose as a DOTS observer — sets the log's
 * `observed_by`, which is what every calendar reads for its verified/pending
 * split. Proof photos are optional evidence, never a requirement.
 */
export async function verifyMedicationLog(
  logId: number,
  notes?: string
): Promise<ApiResponse<ReportMedicationLog>> {
  return api.post<ApiResponse<ReportMedicationLog>>(
    `/medication-logs/${logId}/verify`,
    notes ? { notes } : undefined
  );
}

/** Revert a verification — clears the log's `observed_by`. */
export async function unverifyMedicationLog(
  logId: number
): Promise<ApiResponse<ReportMedicationLog>> {
  return api.post<ApiResponse<ReportMedicationLog>>(
    `/medication-logs/${logId}/unverify`
  );
}
