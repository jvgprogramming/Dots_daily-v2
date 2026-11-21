import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";
import { GuestGuard } from "@/components/auth/guest-guard";
import { AuthShell } from "@/components/auth/auth-shell";
import { PageLoader } from "@/components/ui/page-loader";

export const metadata: Metadata = {
  title: {
    template: "%s | DOTS Daily",
    default: "Sign In | DOTS Daily",
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader fullScreen />}>
      <GuestGuard>
        <AuthShell>{children}</AuthShell>
      </GuestGuard>
    </Suspense>
  );
}
