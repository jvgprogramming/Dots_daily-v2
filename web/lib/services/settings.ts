import { api } from "./api";
import type {
  ApiResponse,
  SettingsData,
  SettingsGroup,
  AuditData,
  AuditFilters,
  LoginActivityData,
  PublicSettings,
  StaffUser,
  CreateStaffUserPayload,
  UpdateStaffUserPayload,
} from "@/lib/types";

/** GET /settings — all sections merged over backend defaults. */
export async function getSettings(): Promise<ApiResponse<SettingsData>> {
  return api.get<ApiResponse<SettingsData>>("/settings");
}

/** GET /settings/public — values any portal screen depends on (risk bands, regimens…). */
export async function getPublicSettings(): Promise<ApiResponse<PublicSettings>> {
  return api.get<ApiResponse<PublicSettings>>("/settings/public");
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

/** POST /settings/users/{id}/revoke-sessions — sign a staff member out everywhere. */
export async function revokeStaffSessions(id: number): Promise<ApiResponse<{ revoked: number }>> {
  return api.post<ApiResponse<{ revoked: number }>>(`/settings/users/${id}/revoke-sessions`);
}

function auditParams(f: AuditFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.area && f.area !== "all") p.area = f.area;
  if (f.user_id) p.user_id = String(f.user_id);
  if (f.from) p.from = f.from;
  if (f.to) p.to = f.to;
  if (f.search) p.search = f.search;
  if (f.page) p.page = String(f.page);
  if (f.per_page) p.per_page = String(f.per_page);
  return p;
}

/** GET /settings/audit — filtered, paginated audit trail. */
export async function getAuditData(filters: AuditFilters = {}): Promise<ApiResponse<AuditData>> {
  return api.get<ApiResponse<AuditData>>("/settings/audit", { params: auditParams(filters) });
}

/** GET /settings/audit/export — the same filters as a CSV download. */
export async function exportAuditCsv(filters: AuditFilters = {}): Promise<void> {
  // Export ignores pagination: it returns every matching row (server-capped).
  return api.download("/settings/audit/export", auditParams({ ...filters, page: undefined, per_page: undefined }), "audit-log.csv");
}

/** GET /settings/login-activity — per-staff sign-in summary. */
export async function getLoginActivity(): Promise<ApiResponse<LoginActivityData>> {
  return api.get<ApiResponse<LoginActivityData>>("/settings/login-activity");
}
