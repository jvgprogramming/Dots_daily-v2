"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Pill,
  Activity,
  Bot,
  BarChart3,
  Bell,
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
    title: "Management",
    items: [
      { label: "Patients", href: "/patients", icon: Users },
      { label: "Treatments", href: "/treatments", icon: Pill },
      {
        label: "Monitoring",
        href: "/monitoring",
        icon: Activity,
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "AI Insights", href: "/ai", icon: Bot },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
      },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
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
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border-light bg-bg-sidebar">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border-light px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary-500 text-sm font-bold text-white">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold leading-tight text-text-primary">
              DOTS Daily
            </span>
            <span className="text-[11px] text-text-tertiary">Admin Portal</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-6" style={{ scrollbarWidth: "thin", scrollbarColor: "transparent transparent" }}>
          {navGroups.map((group, i) => (
            <div key={i} className="mb-7 last:mb-0">
              {group.title && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "text-primary-600"
                            : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                        )}
                      >
                        {/* Left accent bar */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary-500" />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-primary-500" : "text-text-tertiary group-hover:text-text-secondary"
                          )}
                        />
                        <span>{item.label}</span>
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
            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium text-text-tertiary transition-all duration-150 hover:bg-bg-subtle hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
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
          <div className="flex items-start gap-3 rounded-[10px] bg-bg-subtle p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-text-tertiary shrink-0" />
            <div>
              <p className="text-sm text-text-secondary">
                You will be redirected to the sign-in page and will need to
                enter your credentials again to access the dashboard.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowLogoutModal(false)}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-border-default bg-bg-card px-5 py-2.5 text-sm font-medium text-text-primary transition-all duration-200 hover:bg-bg-subtle active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-danger px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-danger/90 active:scale-[0.98] disabled:opacity-50"
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
