"use client";

/**
 * PatientPicker — scalable patient selector for the monitoring dashboard.
 *
 * Replaces the horizontal chip row, which stops working past a handful of
 * patients. Shows only the selected patient in a compact trigger; the full
 * roster lives in a searchable popover with server-side search, paginated
 * "load more", keyboard navigation, and prev/next stepping through results.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPatients } from "@/lib/services/patients";
import type { PatientListItem } from "@/lib/types";

const PAGE_SIZE = 25;

export function patientDisplayName(p: PatientListItem): string {
  return p.first_name ? `${p.first_name} ${p.last_name ?? ""}`.trim() : p.user?.name || `Patient #${p.id}`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

interface PatientPickerProps {
  selectedId: number | null;
  /** Fallback label when the selected patient isn't in the loaded list (e.g. deep link). */
  selectedName?: string;
  onSelect: (patient: PatientListItem) => void;
  /** Called once with the first patient when nothing is selected yet. */
  onFirstLoad?: (patient: PatientListItem) => void;
  onError?: (message: string) => void;
}

export function PatientPicker({ selectedId, selectedName, onSelect, onFirstLoad, onError }: PatientPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PatientListItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCache, setSelectedCache] = useState<PatientListItem | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const firstLoadDone = useRef(false);
  const requestId = useRef(0);

  // ── Fetch a page (page 1 replaces, later pages append) ──
  const fetchPage = useCallback(
    async (term: string, pageNum: number) => {
      const id = ++requestId.current;
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await getPatients({
          search: term,
          page: pageNum,
          per_page: PAGE_SIZE,
          status: "registered",
        });
        if (id !== requestId.current) return; // stale response
        setItems((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
        setPage(res.meta.current_page);
        setLastPage(res.meta.last_page);
        setTotal(res.meta.total);
        if (pageNum === 1) setActiveIndex(0);
        if (!firstLoadDone.current && res.data.length > 0) {
          firstLoadDone.current = true;
          onFirstLoad?.(res.data[0]);
        }
      } catch (err: unknown) {
        if (id === requestId.current) onError?.(err instanceof Error ? err.message : "Failed to load patients");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [onFirstLoad, onError]
  );

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchPage(search, 1), 250);
    return () => clearTimeout(t);
  }, [search, fetchPage]);

  // Remember the selected patient object so the trigger survives searches
  useEffect(() => {
    const found = items.find((p) => p.id === selectedId);
    if (found) setSelectedCache(found);
  }, [items, selectedId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Keep the keyboard-active row in view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const hasMore = page < lastPage;
  const loadMore = () => {
    if (hasMore && !loadingMore && !loading) fetchPage(search, page + 1);
  };

  const choose = (p: PatientListItem) => {
    setSelectedCache(p);
    onSelect(p);
    setOpen(false);
  };

  const onListScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) loadMore();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => {
        const next = Math.min(i + 1, items.length - 1);
        if (next >= items.length - 3) loadMore();
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[activeIndex]) choose(items[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // ── Prev / next stepping through the loaded (filtered) list ──
  const currentIndex = items.findIndex((p) => p.id === selectedId);
  const step = (dir: -1 | 1) => {
    const next = items[currentIndex + dir];
    if (next) {
      choose(next);
      if (dir === 1 && currentIndex + dir >= items.length - 3) loadMore();
    }
  };

  const selected = selectedCache && selectedCache.id === selectedId ? selectedCache : null;
  const label = selected ? patientDisplayName(selected) : selectedName || (selectedId ? `Patient #${selectedId}` : "Select a patient");
  const sub = selected?.user?.email ?? (selectedId ? `ID #${selectedId}` : `${total} registered`);

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "matte-surface flex min-w-0 flex-1 items-center gap-3 rounded-[12px] border px-3 py-2 text-left transition-colors sm:w-85 sm:flex-none",
            open ? "border-primary-300" : "hover:border-border-strong"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-action text-xs font-semibold text-white">
            {selectedId ? initials(label) : <UserRound className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text-primary">{label}</span>
            <span className="block truncate text-xs text-text-tertiary">{sub}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-tertiary transition-transform", open && "rotate-180")} />
        </button>

        <div className="flex items-stretch overflow-hidden rounded-[12px] border border-border-light">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={currentIndex <= 0}
            title="Previous patient"
            className="px-2 text-text-secondary transition-colors hover:bg-bg-subtle disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-px bg-border-light" />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={currentIndex < 0 || currentIndex >= items.length - 1}
            title="Next patient"
            className="px-2 text-text-secondary transition-colors hover:bg-bg-subtle disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 z-40 mt-2 w-full overflow-hidden rounded-[12px] border border-border-light bg-bg-card shadow-lg sm:w-100"
            onKeyDown={onKeyDown}
          >
            <div className="relative border-b border-border-light p-2">
              <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="h-9 w-full rounded-[8px] bg-bg-subtle pl-9 pr-8 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-text-tertiary">
              <span>{loading ? "Searching…" : `${total.toLocaleString()} patient${total === 1 ? "" : "s"}`}</span>
              <span className="hidden sm:inline">↑↓ to navigate · Enter to select</span>
            </div>

            <ul ref={listRef} role="listbox" onScroll={onListScroll} className="max-h-80 overflow-y-auto px-1 pb-1">
              {loading && items.length === 0 ? (
                <li className="flex items-center justify-center gap-2 py-6 text-sm text-text-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading patients…
                </li>
              ) : items.length === 0 ? (
                <li className="py-6 text-center text-sm text-text-tertiary">No registered patients match “{search}”.</li>
              ) : (
                items.map((p, i) => {
                  const name = patientDisplayName(p);
                  const isSelected = p.id === selectedId;
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={p.id}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => choose(p)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[8px] px-2 py-2",
                        isActive && "bg-bg-subtle",
                        isSelected && "bg-primary-100/70"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          isSelected ? "bg-brand-action text-white" : "bg-bg-subtle text-text-tertiary"
                        )}
                      >
                        {initials(name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", isSelected ? "font-semibold text-primary-900" : "text-text-primary")}>
                          {name}
                        </span>
                        {p.user?.email && <span className="block truncate text-xs text-text-tertiary">{p.user.email}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-text-tertiary">#{p.id}</span>
                    </li>
                  );
                })
              )}
              {loadingMore && (
                <li className="flex items-center justify-center py-2 text-text-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
