import { api } from "./api";
import type { ApiResponse, DashboardStatsData } from "@/lib/types";

/**
 * Live dashboard statistics aggregated from the database:
 * KPI cards, adherence trend, patient activity, treatment
 * phase distribution, recent registrations, and overview metrics.
 */
export async function getDashboardStats(): Promise<ApiResponse<DashboardStatsData>> {
  return api.get<ApiResponse<DashboardStatsData>>("/dashboard/stats");
}
