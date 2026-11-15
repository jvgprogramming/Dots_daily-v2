"use client";

import { useEffect, useState } from "react";
import { getPublicSettings } from "@/lib/services/settings";
import type { PublicSettings } from "@/lib/types";

/**
 * Settings values screens depend on (risk bands, regimens, outcomes…), from
 * GET /settings/public. Fetched once per page load and shared by every
 * component; `null` until loaded, so callers keep a sensible fallback.
 */
let cache: PublicSettings | null = null;
let inflight: Promise<PublicSettings | null> | null = null;

function load(): Promise<PublicSettings | null> {
  inflight ??= getPublicSettings()
    .then((res) => (cache = res.data ?? null))
    .catch(() => {
      inflight = null; // allow a retry on the next mount
      return null;
    });
  return inflight;
}

/** Drop the cached copy (e.g. after an admin saves Settings). */
export function invalidateClinicSettings(): void {
  cache = null;
  inflight = null;
}

export function useClinicSettings(): PublicSettings | null {
  const [settings, setSettings] = useState<PublicSettings | null>(cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    load().then((s) => alive && setSettings(s));
    return () => {
      alive = false;
    };
  }, []);

  return settings;
}
