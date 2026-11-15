"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getNotifications } from "@/lib/services/notifications";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";

/** Event the notifications page fires after marking items read. */
export const NOTIFICATIONS_CHANGED = "dots-notifications-changed";

/** Header bell with the unread count (missed-dose escalations, follow-up reminders). */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await getNotifications({ unread: true });
      setUnread(res.data?.unread_count ?? 0);
    } catch {
      /* the bell is best-effort */
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [refresh]);

  // Alerts are generated hourly, so a once-a-minute check is plenty.
  useAutoRefresh(refresh, 60_000);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      title="Notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-border-light text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
