import { api } from "./api";
import type { ApiResponse, StaffNotificationsData } from "@/lib/types";

/** GET /notifications — the signed-in staff member's inbox. */
export async function getNotifications(params: { unread?: boolean; page?: number } = {}): Promise<ApiResponse<StaffNotificationsData>> {
  const p: Record<string, string> = {};
  if (params.unread) p.unread = "1";
  if (params.page) p.page = String(params.page);
  return api.get<ApiResponse<StaffNotificationsData>>("/notifications", { params: p });
}

/** POST /notifications/{id}/read */
export async function markNotificationRead(id: number): Promise<ApiResponse> {
  return api.post<ApiResponse>(`/notifications/${id}/read`);
}

/** POST /notifications/read-all */
export async function markAllNotificationsRead(): Promise<ApiResponse<{ updated: number }>> {
  return api.post<ApiResponse<{ updated: number }>>("/notifications/read-all");
}
