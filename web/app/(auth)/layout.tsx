import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
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
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-main px-4">
        {/* Logo */}
        <Link
          href="/"
          className="relative mb-10 flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary-500 text-sm font-bold text-white">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold leading-tight text-text-primary">
              DOTS Daily
            </span>
            <span className="text-[11px] text-text-tertiary">Admin Portal</span>
          </div>
        </Link>

        {/* Auth card */}
        <div className="relative w-full max-w-sm">{children}</div>

        {/* Footer */}
        <p className="relative mt-10 text-xs text-text-tertiary">
          &copy; {new Date().getFullYear()} DOTS Daily v2.0 &mdash; Thesis Project
        </p>
        </div>
      </GuestGuard>
    </Suspense>
  );
}
