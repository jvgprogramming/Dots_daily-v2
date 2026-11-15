"use client";

import { useAuth } from "@/lib/store/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import type { AuthUser } from "@/lib/types";
import { canAccessPath, homePathFor, isPortalRole } from "@/lib/access";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Optional extra role restriction on top of the per-path access map. */
  allowedRoles?: Array<AuthUser["role"]>;
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleAllowed =
    !!user &&
    isPortalRole(user.role) &&
    (!allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(user.role));
  const pathAllowed = !!user && canAccessPath(user.role, pathname);

  useEffect(() => {
    if (loading) return;

    // Not authenticated → redirect to login
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Not a staff account → back to sign-in
    if (!isPortalRole(user.role)) {
      router.replace("/login");
      return;
    }

    // A page this role may not open → the role's own home page
    if (!roleAllowed || !pathAllowed) {
      router.replace(homePathFor(user.role));
    }
  }, [user, loading, router, pathname, roleAllowed, pathAllowed]);

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

  // Redirect in progress → render nothing
  if (!user || !roleAllowed || !pathAllowed) {
    return null;
  }

  return <>{children}</>;
}
