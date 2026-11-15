import type { AuthUser } from "@/lib/types";

/**
 * Which portal pages each role may open.
 *
 * This only shapes the UI (sidebar, redirects). The backend enforces the same
 * rules on every API call, so hiding a page here is never the security boundary.
 *
 * Roles are fixed presets:
 *   admin  → every module, including System settings
 *   staff  → the clinical workflow, no System settings
 *   patient → mobile app only, no portal access
 */
type Role = AuthUser["role"];

const STAFF_PATHS = [
  "/patients",
  "/monitoring",
  "/treatments",
  "/medications",
  "/reports",
];

export function isPortalRole(role: Role | undefined): boolean {
  return role === "admin" || role === "staff";
}

export function canAccessPath(role: Role | undefined, path: string): boolean {
  if (role === "admin") return true;
  if (role === "staff") {
    return STAFF_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  }
  return false;
}

export function homePathFor(role: Role | undefined): string {
  return role === "staff" ? "/patients" : "/dashboard";
}

/**
 * Where to send a user after sign-in. Only same-site paths the role may open
 * are honoured — anything else (another site, `//host`, an admin page for a
 * staff member) falls back to the role's home page.
 */
export function safeRedirect(role: Role | undefined, requested: string | null): string {
  if (
    requested &&
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.startsWith("/\\") &&
    canAccessPath(role, requested.split(/[?#]/)[0])
  ) {
    return requested;
  }
  return homePathFor(role);
}

export function roleLabel(role: Role | undefined): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "staff":
      return "Staff";
    case "patient":
      return "Patient";
    default:
      return "Staff";
  }
}
