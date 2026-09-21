import { api, ApiError } from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  MedicationInventoryItem,
  MedicationInventorySummary,
  MedicationInventoryPayload,
  MedicationStockMovement,
} from "@/lib/types";

/**
 * Flatten a Laravel validation error response into
 * "Field: message" lines for inline form display.
 */
export function formatValidationErrors(err: unknown): string {
  if (err instanceof ApiError && err.errors) {
    return Object.entries(err.errors)
      .map(([field, messages]) => `${field.replaceAll("_", " ")}: ${messages.join(" ")}`)
      .join("\n");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export interface MedicationInventoryParams {
  page?: number;
  per_page?: number;
  search?: string;
  stock_status?: string;
  storage_condition?: string;
  sort_by?: string;
  sort_dir?: string;
}

/** Paginated medicine inventory list. */
export async function getMedicationInventory(
  params?: MedicationInventoryParams
): Promise<PaginatedResponse<MedicationInventoryItem>> {
  const searchParams: Record<string, string> = {};
  if (params?.page) searchParams.page = String(params.page);
  if (params?.per_page) searchParams.per_page = String(params.per_page);
  if (params?.search) searchParams.search = params.search;
  if (params?.stock_status) searchParams.stock_status = params.stock_status;
  if (params?.storage_condition) searchParams.storage_condition = params.storage_condition;
  if (params?.sort_by) searchParams.sort_by = params.sort_by;
  if (params?.sort_dir) searchParams.sort_dir = params.sort_dir;

  return api.get<PaginatedResponse<MedicationInventoryItem>>("/medications-inventory", {
    params: Object.keys(searchParams).length > 0 ? searchParams : undefined,
  });
}

/** Inventory summary: stock counts, expiry buckets, storage breakdown. */
export async function getMedicationSummary(): Promise<ApiResponse<MedicationInventorySummary>> {
  return api.get<ApiResponse<MedicationInventorySummary>>("/medications-inventory/summary");
}

/** Register a new medicine. */
export async function createMedication(payload: MedicationInventoryPayload): Promise<ApiResponse> {
  return api.post<ApiResponse>("/medications-inventory", payload);
}

/** Update a medicine. The ONLY place stock quantity changes — logged in the movement ledger. */
export async function updateMedication(
  id: number,
  payload: MedicationInventoryPayload
): Promise<ApiResponse> {
  return api.put<ApiResponse>(`/medications-inventory/${id}`, payload);
}

/** Remove a medicine from active inventory (archived, not deleted). */
export async function deleteMedication(id: number): Promise<ApiResponse> {
  return api.delete<ApiResponse>(`/medications-inventory/${id}`);
}

/** Stock movement history (audit trail) for a medicine. */
export async function getMedicationMovements(
  id: number,
  page = 1
): Promise<PaginatedResponse<MedicationStockMovement>> {
  return api.get(`/medications-inventory/${id}/movements`, {
    params: { page: String(page), per_page: "10" },
  });
}
