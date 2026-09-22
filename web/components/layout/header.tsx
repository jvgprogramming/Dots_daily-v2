"use client";

import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/layout/global-search";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border-light bg-bg-card/80 backdrop-blur-xl px-8">
      {/* Search */}
      <GlobalSearch />

      {/* Right section */}
      <div className="flex items-center gap-1">
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
