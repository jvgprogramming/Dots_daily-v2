import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";
import { GuestGuard } from "@/components/auth/guest-guard";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

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
        <div className="auth-canvas min-h-screen lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <AuthBrandPanel />
          <main className="flex min-h-[calc(100vh-68px)] flex-col lg:min-h-screen">
            <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
              <div className="w-full max-w-[400px]">{children}</div>
            </div>
            <footer className="px-5 pb-6 text-center text-[12px] text-text-tertiary sm:px-10 lg:text-left">
              © {new Date().getFullYear()} Capiz Emmanuel Hospital
            </footer>
          </main>
        </div>
      </GuestGuard>
    </Suspense>
  );
}
