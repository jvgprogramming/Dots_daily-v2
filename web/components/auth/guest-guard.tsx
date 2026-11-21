"use client";

import { useAuth } from "@/lib/store/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeRedirect } from "@/lib/access";
import { PageLoader } from "@/components/ui/page-loader";

interface GuestGuardProps {
  children: React.ReactNode;
}

export function GuestGuard({ children }: GuestGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;

    // Already authenticated → the requested page if the role may open it,
    // otherwise the role's home page (never another site)
    if (user) {
      router.replace(safeRedirect(user.role, searchParams.get("redirect")));
    }
  }, [user, loading, router, searchParams]);

  // Show nothing while checking auth status
  if (loading) {
    return <PageLoader fullScreen />;
  }

  // Already authenticated → render nothing (redirect is in progress)
  if (user) {
    return null;
  }

  // Not authenticated → show auth page content
  return <>{children}</>;
}
