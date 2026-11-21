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
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth";
import { Modal } from "@/components/ui/modal";
import { canAccessPath } from "@/lib/access";

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
        title="Sign out"
        description="Are you sure you want to sign out of your account?"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-[10px] border border-border-light bg-bg-subtle p-3.5">
            <AlertCircle className="mt-px h-4 w-4 shrink-0 text-text-tertiary" />
            <div>
              <p className="text-[12.5px] leading-relaxed text-text-secondary">
                You will be redirected to the sign-in page and will need to
                enter your credentials again to access the dashboard.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border-default bg-bg-card px-4 text-[13px] font-medium text-text-primary transition-colors hover:bg-bg-subtle disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-danger px-4 text-[13px] font-medium text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
            >
              {loggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing out...
                </>
              ) : (
                "Sign Out"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
