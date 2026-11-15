"use client";

/**
 * Notifications — the staff inbox for alerts raised by the system:
 * missed-dose escalations and follow-up reminders (Settings → Notifications).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellOff, CalendarClock, CheckCheck, Loader2, PillBottle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { errorMessage } from "@/lib/services/api";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/services/notifications";
import { NOTIFICATIONS_CHANGED } from "@/components/layout/notification-bell";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import type { StaffNotification, StaffNotificationsData } from "@/lib/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsPage() {
  const [data, setData] = useState<StaffNotificationsData | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await getNotifications({ unread: unreadOnly, page });
        if (res.data) setData(res.data);
      } catch (err) {
        setError(errorMessage(err, "Failed to load notifications"));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [unreadOnly, page]
  );

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(() => load(true));

  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  const markOne = async (n: StaffNotification) => {
    if (n.is_read) return;
    setData((d) =>
      d
        ? {
            ...d,
            unread_count: Math.max(0, d.unread_count - 1),
            notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
          }
        : d
    );
    try {
      await markNotificationRead(n.id);
      changed();
    } catch {
      /* the next refresh will correct it */
    }
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await markAllNotificationsRead();
      changed();
      await load(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to mark notifications as read"));
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-lede">Missed-dose escalations and follow-up reminders for your patients.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={marking || (data?.unread_count ?? 0) === 0}>
          {marking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
          Mark all as read
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <div className="inline-flex rounded-[8px] bg-bg-subtle p-0.5" role="group" aria-label="Filter">
        {[
          { v: false, label: "All" },
          { v: true, label: `Unread${data?.unread_count ? ` (${data.unread_count})` : ""}` },
        ].map((o) => (
          <button
            key={String(o.v)}
            onClick={() => {
              setUnreadOnly(o.v);
              setPage(1);
            }}
            className={`rounded-[6px] px-3 py-1 text-xs font-medium transition-all ${
              unreadOnly === o.v ? "bg-bg-card text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-[12px]" />
          ))}
        </div>
      ) : (data?.notifications.length ?? 0) === 0 ? (
        <EmptyState
          icon={<BellOff className="h-5 w-5" />}
          title={unreadOnly ? "You're all caught up" : "No notifications yet"}
          description="Alerts appear here when a patient misses doses in a row or a follow-up is coming up. Thresholds are set in Settings → Notifications."
        />
      ) : (
        <ul className="space-y-2">
          {data?.notifications.map((n) => {
            const Icon = n.type === "followup_reminder" ? CalendarClock : PillBottle;
            const tone = n.type === "followup_reminder" ? "bg-primary-100/70 text-primary-700" : "bg-danger-bg text-danger";
            return (
              <li key={n.id}>
                <div
                  className={`matte-surface flex items-start gap-3 rounded-[12px] border p-4 transition-colors ${
                    n.is_read ? "opacity-75" : "border-primary-300/60"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className={`text-sm ${n.is_read ? "text-text-secondary" : "font-semibold text-text-primary"}`}>{n.title}</p>
                      <span className="text-[11px] text-text-tertiary">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary">{n.body}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      {n.data?.link && (
                        <Link href={String(n.data.link)} onClick={() => markOne(n)} className="font-medium text-primary-700 hover:underline">
                          {n.type === "followup_reminder" ? "Open treatments" : "Open monitoring"}
                        </Link>
                      )}
                      {!n.is_read && (
                        <button type="button" onClick={() => markOne(n)} className="text-text-tertiary hover:text-text-primary">
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Unread" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.meta.last_page > 1 && (
        <Pagination currentPage={data.meta.current_page} totalPages={data.meta.last_page} onPageChange={setPage} />
      )}
    </div>
  );
}
