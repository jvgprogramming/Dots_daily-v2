"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Users, SearchX, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalSearch } from "@/hooks/use-global-search";
import type { PatientSelectOption } from "@/lib/types";

export function GlobalSearch() {
  const router = useRouter();
  const { query, setQuery, results, loading, error } = useGlobalSearch();
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
  }, [results]);

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

  const goToList = (q: string) => {
    setOpen(false);
    router.push(`/patients?q=${encodeURIComponent(q)}`);
  };

  const selectPatient = (p: PatientSelectOption) => {
    setOpen(false);
    setQuery("");
    router.push(`/patients?q=${encodeURIComponent(p.name)}`);
  };

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        selectPatient(results[activeIndex]);
      } else if (query.trim()) {
        goToList(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          placeholder="Search patients..."
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

          {!loading && !error && results.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-tertiary">
              <SearchX className="h-4 w-4" />
              No patients match “{query.trim()}”
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <ul className="max-h-72 overflow-y-auto py-1">
                {results.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => selectPatient(p)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === activeIndex ? "bg-primary-50" : ""
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-primary-50 text-primary-700">
                        <Users className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-text-tertiary">
                          {p.email}
                          {p.health_id_number ? ` · ${p.health_id_number}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border-light bg-bg-subtle/50 px-4 py-2">
                <span className="text-[11px] text-text-tertiary">
                  {results.length} result{results.length !== 1 && "s"}
                </span>
                <button
                  type="button"
                  onClick={() => goToList(query.trim())}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:text-primary-800"
                >
                  See all results
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
