"use client";

import { Bell, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/layout/global-search";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border-light bg-bg-card/80 backdrop-blur-xl px-8">
      {/* Search */}
      <GlobalSearch />

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-[8px] text-text-tertiary transition-all duration-150 hover:bg-bg-subtle hover:text-text-secondary">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
          </span>
        </button>

        {/* Divider */}
        <div className="mx-2 h-5 w-px bg-border-light" />

        {/* User */}
        <button className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 transition-all duration-150 hover:bg-bg-subtle">
          <Avatar size="sm" fallback="A" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-text-primary leading-tight">
              Admin User
            </p>
            <p className="text-xs text-text-tertiary">admin@dotsdaily.com</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
        </button>
      </div>
    </header>
  );
}
