import { api } from "./api";
import type { ApiResponse, PatientMonitoringData } from "@/lib/types";

export interface MonitoringParams {
  patient_id: number;
  /** ISO date (YYYY-MM-DD) — defaults to current month start on the backend */
  from?: string;
  /** ISO date (YYYY-MM-DD) — defaults to current month end on the backend */
  to?: string;
  /** ISO date (YYYY-MM-DD) — selected calendar day; returns its dose-level logs. */
  date?: string;
}

/**
 * Patient-centric monitoring data for the admin monitoring calendar:
 * treatment plan timeline, per-date medication adherence, daily monitoring
 * entries, summary stats, and risk/progress indicators.
 */
export async function getPatientMonitoring(params: MonitoringParams): Promise<ApiResponse<PatientMonitoringData>> {
  const searchParams: Record<string, string> = {
    patient_id: String(params.patient_id),
  };
  if (params.from) searchParams.from = params.from;
  if (params.to) searchParams.to = params.to;
  if (params.date) searchParams.date = params.date;

  return api.get<ApiResponse<PatientMonitoringData>>("/patients/monitoring", {
    params: searchParams,
  });
}
