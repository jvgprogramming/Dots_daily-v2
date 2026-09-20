"use client";

import { useEffect, useState } from "react";
import { getPatientList } from "@/lib/services/patients";
import type { PatientSelectOption } from "@/lib/types";

interface UseGlobalSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: PatientSelectOption[];
  loading: boolean;
  error: string;
}

/**
 * Global patient search with debounced API calls.
 * Used by the top-bar search in the dashboard header.
 */
export function useGlobalSearch(delay = 300): UseGlobalSearchResult {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<PatientSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    getPatientList(debounced)
      .then((res) => {
        if (cancelled) return;
        setResults(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return { query, setQuery, results, loading, error };
}
