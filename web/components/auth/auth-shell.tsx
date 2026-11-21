"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

/**
 * Animated frame shared by every sign-in screen: a drifting backdrop with one
 * floating card that pops in, brand panel on the left, the page's form on the
 * right. The card mounts once; only the form side re-animates when moving
 * between login / forgot / reset (keyed on the path).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    // reducedMotion="user" makes every motion component honour the OS
    // "reduce motion" setting (transforms are skipped, fades remain).
    <MotionConfig reducedMotion="user">
      <div className="auth-stage relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-6 sm:px-6 lg:py-10">
        <div aria-hidden="true" className="auth-orb auth-orb--a" />
        <div aria-hidden="true" className="auth-orb auth-orb--b" />
        <div aria-hidden="true" className="auth-orb auth-orb--c" />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 210, damping: 22, mass: 0.9 }}
          className="auth-card grid w-full max-w-[1100px] overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-2.5"
        >
          <AuthBrandPanel />

          <main className="flex flex-col px-6 pb-6 pt-8 sm:px-10 lg:px-12 lg:pb-8 lg:pt-12 xl:px-16">
            <div className="flex flex-1 items-center justify-center">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[380px]"
              >
                {children}
              </motion.div>
            </div>
            <footer className="mt-10 text-center text-[12px] text-text-tertiary">
              © {new Date().getFullYear()} Capiz Emmanuel Hospital
            </footer>
          </main>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
