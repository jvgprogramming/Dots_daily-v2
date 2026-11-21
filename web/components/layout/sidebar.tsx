"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Pill,
  Activity,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { canAccessPath, roleLabel } from "@/lib/access";

const navGroups = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Clinical Workflow",
    items: [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Treatments", href: "/treatments", icon: ClipboardList },
      { label: "Medication", href: "/medications", icon: Pill },
      {
        label: "Monitoring",
        href: "/monitoring",
        icon: Activity,
      },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3 }],
  },
  {
    title: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Only the pages this role may open; groups left empty are dropped.
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPath(user?.role, item.href)),
    }))
    .filter((group) => group.items.length > 0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } catch {
      // Even if the API call fails, clear local state and redirect
      router.push("/login");
    } finally {
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  }, [logout, router]);

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col border-r border-border-light bg-bg-sidebar md:w-64">
        {/* Logo */}
        <div className="flex h-[68px] items-center justify-center gap-3 md:justify-start md:px-5">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[11px] bg-white shadow-sm ring-1 ring-border-light">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/imports/image-2.png"
              alt="CEH logo"
              className="h-8 w-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="hidden flex-col gap-1 md:flex">
            <span className="text-[15px] font-bold leading-none tracking-[-0.015em] text-text-primary">
              DOTS Daily
            </span>
            <span className="text-[11.5px] font-medium leading-none text-text-secondary">
              TB DOTS Center
            </span>
          </div>
        </div>

        <div className="mx-3 h-px bg-border-light md:mx-5" />

        {/* Navigation */}
        <nav
          className="sidebar-scroll flex-1 overflow-y-auto px-2 py-5 md:px-3"
        >
          {visibleGroups.map((group, i) => (
            <div key={i} className="mb-3 last:mb-0 md:mb-5">
              {group.title && (
                <p className="mb-1.5 hidden px-3 text-[11.5px] font-semibold text-text-tertiary md:block">
                  {group.title}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // Sub-pages (e.g. /patients/12) keep their parent highlighted.
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center justify-center gap-3 rounded-[10px] px-0 py-2.5 text-[13.5px] transition-colors duration-150 md:justify-start md:px-3",
                          isActive
                            ? "font-semibold text-white"
                            : "font-medium text-text-body hover:bg-primary-50 hover:text-text-primary"
                        )}
                      >
                        {/* One shared layoutId: framer slides this pill from
                            the old item to the new one on navigation. */}
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className="absolute inset-0 rounded-[10px] bg-brand-action shadow-[0_6px_16px_-8px_rgb(11_90_60/0.7)]"
                          />
                        )}
                        <Icon
                          className={cn(
                            "relative h-[17px] w-[17px] shrink-0 stroke-[1.9] transition-transform duration-200",
                            isActive
                              ? "text-white"
                              : "text-text-tertiary group-hover:scale-110 group-hover:text-primary-700"
                          )}
                        />
                        <span className="relative hidden md:inline">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Hospital card (expanded sidebar only) */}
        <div className="hidden px-3 pb-3 md:block">
          <div className="side-brand-card px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/70">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Authorized staff
            </p>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug">
              Capiz Emmanuel Hospital
            </p>
            <p className="mt-0.5 text-[11.5px] text-white/65">TB DOTS Center</p>
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-border-light p-3">
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Logout"
            aria-label="Logout"
            className="group flex w-full items-center justify-center gap-3 rounded-[10px] px-0 py-2.5 text-[13.5px] font-medium text-text-secondary transition-colors duration-150 hover:bg-danger-bg hover:text-danger-text md:justify-start md:px-3"
          >
            <LogOut className="h-[17px] w-[17px] stroke-[1.9] transition-transform duration-200 group-hover:translate-x-0.5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      <Modal
        open={showLogoutModal}
        onClose={() => !loggingOut && setShowLogoutModal(false)}
        size="sm"
      >
        <div className="flex flex-col items-center pt-2 text-center">
          {/* Green badge pops in after the panel, icon nudges toward the door */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.08 }}
            className="relative"
          >
            <span aria-hidden="true" className="signout-ring" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-action text-white shadow-[0_8px_18px_-8px_rgb(11_90_60/0.8)]">
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                  className="flex"
                >
                  <LogOut className="h-5 w-5" strokeWidth={2} />
                </motion.span>
              </span>
            </span>
          </motion.div>

          <h2 className="mt-5 text-[18px] font-bold tracking-[-0.02em] text-text-primary">
            Sign out of DOTS Daily?
          </h2>
          <p className="mt-1.5 max-w-[30ch] text-[13px] leading-relaxed text-text-secondary">
            You&apos;ll return to the sign-in page and need your credentials to come back.
          </p>

          {/* Who is being signed out */}
          <div className="mt-5 flex w-full items-center gap-3 rounded-[12px] border border-border-light bg-bg-subtle px-3.5 py-3 text-left">
            <Avatar
              size="default"
              fallback={user?.name ?? "?"}
              className="bg-brand-action text-white ring-2 ring-primary-100"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">
                {user?.name ?? "—"}
              </p>
              <p className="mt-1 truncate text-[11.5px] leading-tight text-text-secondary">
                {roleLabel(user?.role)} · {user?.email ?? ""}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-2 py-1 text-[10.5px] font-semibold text-primary-700 ring-1 ring-primary-100">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              Active
            </span>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Always sign out on shared computers.
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
            >
              Stay signed in
            </Button>
            <Button onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? (
                <>
                  <Loader2 className="animate-spin" />
                  Signing out…
                </>
              ) : (
                <>
                  <LogOut />
                  Sign out
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
