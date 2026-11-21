"use client";

import { useAuth } from "@/lib/store/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import type { AuthUser } from "@/lib/types";
import { canAccessPath, homePathFor, isPortalRole } from "@/lib/access";
import { PageLoader } from "@/components/ui/page-loader";

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
    return <PageLoader fullScreen label="Checking your session…" />;
  }

  // Redirect in progress → render nothing
  if (!user || !roleAllowed || !pathAllowed) {
    return null;
  }

  return <>{children}</>;
}
