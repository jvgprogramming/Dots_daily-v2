"use client";

import { useAuth } from "@/lib/store/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface GuestGuardProps {
  children: React.ReactNode;
}

export function GuestGuard({ children }: GuestGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading) return;

    // Already authenticated → redirect to dashboard (or custom redirect)
    if (user) {
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.replace(redirectTo);
    }
  }, [user, loading, router, searchParams]);

  // Show nothing while checking auth status
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

  // Already authenticated → render nothing (redirect is in progress)
  if (user) {
    return null;
  }

  // Not authenticated → show auth page content
  return <>{children}</>;
}
