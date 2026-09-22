import { api } from "./api";
import type {
  ApiResponse,
  SettingsData,
  SettingsGroup,
  AuditData,
  StaffUser,
  CreateStaffUserPayload,
  UpdateStaffUserPayload,
} from "@/lib/types";

/** GET /settings — all sections merged over backend defaults. */
export async function getSettings(): Promise<ApiResponse<SettingsData>> {
  return api.get<ApiResponse<SettingsData>>("/settings");
}

/** PUT /settings — persist one group of keys. */
export async function updateSettings(
  group: SettingsGroup,
  values: Record<string, string | boolean>
): Promise<ApiResponse<{ changed: number }>> {
  return api.put<ApiResponse<{ changed: number }>>("/settings", { group, values });
}

/** GET /settings/users — staff accounts. */
export async function getStaffUsers(search?: string): Promise<ApiResponse<{ users: StaffUser[] }>> {
  return api.get<ApiResponse<{ users: StaffUser[] }>>("/settings/users", {
    params: search ? { search } : undefined,
  });
}

/** POST /settings/users — create a staff account. */
export async function createStaffUser(payload: CreateStaffUserPayload): Promise<ApiResponse<{ user: StaffUser }>> {
  return api.post<ApiResponse<{ user: StaffUser }>>("/settings/users", payload);
}

/** PUT /settings/users/{id} — update role, permissions, or status. */
export async function updateStaffUser(
  id: number,
  payload: UpdateStaffUserPayload
): Promise<ApiResponse<{ user: StaffUser }>> {
  return api.put<ApiResponse<{ user: StaffUser }>>(`/settings/users/${id}`, payload);
}

/** DELETE /settings/users/{id} — remove a staff account. */
export async function deleteStaffUser(id: number): Promise<ApiResponse> {
  return api.delete<ApiResponse>(`/settings/users/${id}`);
}

/** GET /settings/audit — audit log + login activity. */
export async function getAuditData(type?: "all" | "logins" | "changes"): Promise<ApiResponse<AuditData>> {
  return api.get<ApiResponse<AuditData>>("/settings/audit", {
    params: type && type !== "all" ? { type } : undefined,
  });
}
