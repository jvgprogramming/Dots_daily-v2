"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion, type Variants } from "framer-motion";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { isRecoveryPath, SWAP_DURATION, SWAP_EASE } from "@/components/auth/swap-motion";
import { cn } from "@/lib/utils";

const SWAP_TRANSITION = {
  layout: { duration: SWAP_DURATION, ease: SWAP_EASE },
} as const;

/* The brand panel dips to 96% mid-slide and grows back as it lands, which
   makes it read as lifted off the card while it travels. Both states run the
   same keyframes; switching between them is what replays the dip. */
const panelLift: Variants = {
  left: { scale: [1, 0.96, 1], transition: { duration: SWAP_DURATION, ease: SWAP_EASE } },
  right: { scale: [1, 0.96, 1], transition: { duration: SWAP_DURATION, ease: SWAP_EASE } },
};

/**
 * Animated frame shared by every sign-in screen: a drifting backdrop with one
 * floating card that pops in, brand panel on the left, the page's form on the
 * right. The card mounts once; only the form side re-animates when moving
 * between login / forgot / reset (keyed on the path).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const swapped = isRecoveryPath(pathname);

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
          {/* Brand side. `layout` makes framer animate it to its new grid
              slot whenever the order class below flips. It sits above the
              form (z-10) so the green panel sweeps over it mid-swap. */}
          <motion.div
            layout
            transition={SWAP_TRANSITION}
            variants={panelLift}
            initial={false}
            animate={swapped ? "right" : "left"}
            className={cn("relative z-10 lg:flex lg:flex-col", swapped ? "lg:order-2" : "lg:order-1")}
          >
            <AuthBrandPanel swapped={swapped} />
          </motion.div>

          <motion.main
            layout
            transition={SWAP_TRANSITION}
            className={cn(
              "flex flex-col px-6 pb-6 pt-8 sm:px-10 lg:px-12 lg:pb-8 lg:pt-12 xl:px-16",
              swapped ? "lg:order-1" : "lg:order-2"
            )}
          >
            <div className="flex flex-1 items-center justify-center">
              {/* The new form waits for the green panel to sweep past, then
                  glides in the same way its side is travelling: leftward on
                  the recovery screens, rightward back to sign-in. */}
              <motion.div
                key={pathname}
                initial={{ opacity: 0, x: swapped ? 48 : -48 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[380px]"
              >
                {children}
              </motion.div>
            </div>
            <footer className="mt-10 text-center text-[12px] text-text-tertiary">
              © {new Date().getFullYear()} Capiz Emmanuel Hospital
            </footer>
          </motion.main>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
