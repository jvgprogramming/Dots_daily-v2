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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth";
import { Modal } from "@/components/ui/modal";

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
  const { logout } = useAuth();
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
        <div className="flex h-16 items-center justify-center gap-3 md:justify-start md:px-5">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[9px] bg-primary-900">
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
          <div className="hidden flex-col gap-0.5 md:flex">
            <span className="text-[13.5px] font-semibold leading-none tracking-[-0.015em] text-text-primary">
              DOTS Daily
            </span>
            <span className="text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-text-secondary">
              TB DOTS Center
            </span>
          </div>
        </div>

        <div className="mx-3 h-px bg-border-light md:mx-5" />

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-5 md:px-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "transparent transparent" }}
        >
          {navGroups.map((group, i) => (
            <div key={i} className="mb-3 last:mb-0 md:mb-6">
              {group.title && (
                <p className="mb-2 hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-text-secondary md:block">
                  {group.title}
                </p>
              )}
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        aria-label={item.label}
                        className={cn(
                          "group flex items-center justify-center gap-2.5 rounded-[7px] px-0 py-2.5 text-[13px] transition-colors duration-150 md:justify-start md:px-2.5 md:py-2",
                          isActive
                            ? "bg-primary-100/70 font-medium text-primary-900"
                            : "font-normal text-text-body hover:bg-bg-subtle hover:text-text-primary"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[15px] w-[15px] shrink-0 stroke-[1.75]",
                            isActive
                              ? "text-primary-800"
                              : "text-text-tertiary group-hover:text-text-body"
                          )}
                        />
                        <span className="hidden md:inline">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-border-light p-3">
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Logout"
            aria-label="Logout"
            className="flex w-full items-center justify-center gap-2.5 rounded-[7px] px-0 py-2.5 text-[13px] text-text-secondary transition-colors duration-150 hover:bg-danger-bg/60 hover:text-danger-text md:justify-start md:px-2.5 md:py-2"
          >
            <LogOut className="h-[15px] w-[15px] stroke-[1.75]" />
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
