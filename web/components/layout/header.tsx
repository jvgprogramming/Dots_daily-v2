"use client";

import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/layout/global-search";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border-light bg-bg-card px-4 sm:gap-4 sm:px-8 lg:px-10">
      {/* Search */}
      <GlobalSearch />

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Divider */}
        <div className="mx-2 h-5 w-px bg-border-light" />

        {/* User */}
        <button className="flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 transition-colors duration-150 hover:bg-bg-subtle">
          <Avatar size="sm" fallback="A" />
          <div className="hidden text-left sm:block">
            <p className="text-[12.5px] font-medium leading-tight text-text-primary">
              Admin User
            </p>
            <p className="mt-0.5 text-[10.5px] leading-tight text-text-secondary">
              admin@dotsdaily.com
            </p>
          </div>
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </button>
      </div>
    </header>
  );
}
