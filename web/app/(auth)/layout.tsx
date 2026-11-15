import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";
import { GuestGuard } from "@/components/auth/guest-guard";

export const metadata: Metadata = {
  title: {
    template: "%s | DOTS Daily",
    default: "Sign In | DOTS Daily",
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg-main">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:-0.3s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary-500 [animation-delay:-0.15s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary-600" />
        </div>
      </div>
    }>
      <GuestGuard>
        <div className="auth-canvas relative flex min-h-screen items-center justify-center overflow-hidden">
          <div className="flex w-full items-center justify-center">{children}</div>
        </div>
      </GuestGuard>
    </Suspense>
  );
}
