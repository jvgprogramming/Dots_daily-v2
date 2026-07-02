"use client";

import { useAuth } from "@/lib/store/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Required role. If omitted, any authenticated user can access. */
  allowedRoles?: Array<"admin" | "patient">;
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Not authenticated → redirect to login
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Role check — if the page restricts roles and the user doesn't match
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      // Redirect to landing page — don't redirect back to /dashboard
      // which would cause an infinite loop since dashboard also has role checks
      router.replace("/");
    }
  }, [user, loading, router, pathname, allowedRoles]);

  // Show nothing while checking auth (prevents flash of protected content)
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-main">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500">
            <span className="text-sm font-bold text-white">D</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:-0.3s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated → render nothing (redirect is in progress)
  if (!user) {
    return null;
  }

  // Role check failed → render nothing (redirect is in progress)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  // Authorized → render children
  return <>{children}</>;
}
