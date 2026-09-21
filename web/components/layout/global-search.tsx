"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Users,
  Pill,
  Activity,
  ClipboardList,
  SearchX,
  CornerDownLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalSearch } from "@/hooks/use-global-search";
import type { GlobalSearchResultItem } from "@/lib/types";

const TYPE_ICONS: Record<GlobalSearchResultItem["type"], React.ElementType> = {
  patient: Users,
  treatment_plan: ClipboardList,
  medication: Pill,
  monitoring_entry: Activity,
};

/** Where each result type navigates */
function hrefFor(item: GlobalSearchResultItem, query: string): string {
  switch (item.type) {
    case "patient":
      return `/patients?q=${encodeURIComponent(item.title)}`;
    case "treatment_plan":
    case "monitoring_entry":
      return `/monitoring?patient=${item.patient_id ?? ""}`;
    case "medication":
      return `/patients?q=${encodeURIComponent(query)}`;
  }
}

export function GlobalSearch() {
  const router = useRouter();
  const { query, setQuery, groups, items, totals, loading, error } = useGlobalSearch();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showDropdown = open && query.trim().length >= 2;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset highlight when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [items]);

  // ⌘K / Ctrl+K focuses the search
  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const selectItem = (item: GlobalSearchResultItem) => navigate(hrefFor(item, query.trim()));

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        selectItem(items[activeIndex]);
      } else if (query.trim()) {
        navigate(`/patients?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
  }

  // Flat index of each item (matches keyboard navigation order)
  const flatIndex = new Map(items.map((it, idx) => [`${it.type}-${it.id}`, idx]));

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          placeholder="Search anything… patients, medications, treatments"
          className="pl-9 h-9 rounded-[8px] bg-bg-subtle border-border-light text-sm placeholder:text-text-tertiary pr-12"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border-light bg-bg-card px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary sm:block">
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[10px] border border-border-light bg-bg-card shadow-dropdown"
        >
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
              Searching…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-3 text-sm text-danger-text">{error}</div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-tertiary">
              <SearchX className="h-4 w-4" />
              Nothing found for “{query.trim()}”
            </div>
          )}

          {!loading && items.length > 0 && (
            <>
              <div className="max-h-80 overflow-y-auto py-1">
                {groups.map((group) => (
                  <div key={group.type}>
                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {group.label}
                    </p>
                    <ul>
                      {group.items.map((item) => {
                        const i = flatIndex.get(`${item.type}-${item.id}`) ?? -1;
                        const Icon = TYPE_ICONS[item.type];
                        return (
                          <li key={`${item.type}-${item.id}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={i === activeIndex}
                              onMouseEnter={() => setActiveIndex(i)}
                              onClick={() => selectItem(item)}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                i === activeIndex ? "bg-primary-50" : ""
                              }`}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-primary-50 text-primary-700">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="block truncate text-sm font-medium text-text-primary">
                                    {item.title}
                                  </span>
                                  {item.status && (
                                    <span className="shrink-0 rounded-full bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium capitalize text-text-tertiary">
                                      {item.status.replace(/_/g, " ")}
                                    </span>
                                  )}
                                </span>
                                <span className="block truncate text-xs text-text-tertiary">
                                  {[item.subtitle, item.meta].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border-light bg-bg-subtle/50 px-4 py-2">
                <span className="text-[11px] text-text-tertiary">
                  {totals?.all ?? items.length} result{(totals?.all ?? items.length) !== 1 && "s"}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/patients?q=${encodeURIComponent(query.trim())}`)}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:text-primary-800"
                >
                  See all patient results
                  <CornerDownLeft className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
