"use client";

import { useEffect, useState } from "react";
import { globalSearch } from "@/lib/services/search";
import type { GlobalSearchData, GlobalSearchResultItem } from "@/lib/types";

interface UseGlobalSearchResult {
  query: string;
  setQuery: (q: string) => void;
  /** Grouped results in display order */
  groups: Array<{ type: GlobalSearchResultItem["type"]; label: string; items: GlobalSearchResultItem[] }>;
  items: GlobalSearchResultItem[];
  totals: GlobalSearchData["totals"] | null;
  loading: boolean;
  error: string;
}

const GROUP_LABELS: Record<GlobalSearchResultItem["type"], string> = {
  patient: "Patients",
  treatment_plan: "Treatment Plans",
  medication: "Medications",
  monitoring_entry: "Monitoring",
};

/**
 * Global search across patients, treatment plans, medications, and
 * monitoring entries with debounced API calls.
 * Used by the top-bar search in the dashboard header.
 */
export function useGlobalSearch(delay = 300): UseGlobalSearchResult {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<GlobalSearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  useEffect(() => {
    if (debounced.length < 2) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    globalSearch(debounced)
      .then((res) => {
        if (cancelled) return;
        setData(res.data ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const groups: UseGlobalSearchResult["groups"] = data
    ? (
        [
          ["patient", data.patients],
          ["treatment_plan", data.treatment_plans],
          ["medication", data.medications],
          ["monitoring_entry", data.monitoring_entries],
        ] as const
      )
        .filter(([, items]) => items.length > 0)
        .map(([type, items]) => ({ type, label: GROUP_LABELS[type], items }))
    : [];

  const items = groups.flatMap((g) => g.items);

  return { query, setQuery, groups, items, totals: data?.totals ?? null, loading, error };
}
