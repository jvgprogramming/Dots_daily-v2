import { api } from "./api";
import type { ApiResponse, GlobalSearchData } from "@/lib/types";

/**
 * Global search across patients, treatment plans, medications,
 * and monitoring entries. Returns grouped, linkable results.
 */
export async function globalSearch(q: string, limit = 5): Promise<ApiResponse<GlobalSearchData>> {
  return api.get<ApiResponse<GlobalSearchData>>("/search", {
    params: { q, limit: String(limit) },
  });
}
