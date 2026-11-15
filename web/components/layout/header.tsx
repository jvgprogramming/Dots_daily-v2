"use client";

import { useSyncExternalStore } from "react";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/layout/global-search";
import { useAuth } from "@/lib/store/auth";
import { roleLabel } from "@/lib/access";

const THEME_STORAGE_KEY = "dots-daily-theme";
const THEME_CHANGE_EVENT = "dots-daily-theme-change";

function subscribeToTheme(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    document.documentElement.classList.toggle("dark", event.newValue === "dark");
    onChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

export function Header() {
  const { user } = useAuth();
  // Global search queries every patient, so it is an admin-only tool.
  const canSearch = user?.role === "admin";

  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const toggleTheme = () => {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);

    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        nextIsDark ? "dark" : "light"
      );
    } catch (error) {
      console.error("Unable to save the theme preference.", error);
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border-light bg-bg-card/95 px-4 backdrop-blur-sm sm:gap-4 sm:px-8 lg:px-10">
      {/* Search (admins only) */}
      {canSearch && <GlobalSearch />}

      {/* Right section */}
      <div className="ml-auto flex items-center gap-1">
        {/* Divider */}
        <div className="mx-2 h-5 w-px bg-border-light" />

        {/* User */}
        <button className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors duration-150 hover:bg-bg-subtle">
          <Avatar size="default" fallback={user?.name ?? "?"} className="bg-brand-action text-white" />
          <div className="hidden text-left sm:block">
            <p className="text-[13px] font-semibold leading-tight text-text-primary">
              {user?.name ?? "—"}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-tight text-text-secondary">
              {roleLabel(user?.role)} · {user?.email ?? ""}
            </p>
          </div>
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </button>
        <div className="mx-2 h-5 w-px bg-border-light" />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          aria-pressed={isDark}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border-light text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
