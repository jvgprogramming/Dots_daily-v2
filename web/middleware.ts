import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This middleware only handles technical redirects.
// Authentication and role-based access are handled by client-side
// AuthGuard and GuestGuard components which CAN read localStorage.
//
// AuthGuard (components/auth/auth-guard.tsx):
//   - Protects dashboard routes from unauthenticated users
//   - Enforces role-based access (admin-only pages)
//
// GuestGuard (components/auth/guest-guard.tsx):
//   - Prevents authenticated users from accessing login/register

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
