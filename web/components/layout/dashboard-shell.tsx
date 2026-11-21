"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface IDashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: IDashboardShellProps) {
  const pathname = usePathname();

  return (
    // Honour the OS "reduce motion" setting for every animation in the portal.
    <MotionConfig reducedMotion="user">
      <div className="dash-canvas min-h-screen">
        <Sidebar />
        <div className="pl-16 md:pl-64">
          <Header />
          <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            {/* Keyed on the path so each page eases in when you navigate.
                Only opacity + y animate; framer resets transform to "none"
                when done, so fixed-position modals inside pages still cover
                the full viewport. */}
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
