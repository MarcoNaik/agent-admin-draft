"use client";

import { useSyncNotifications } from "@/hooks/use-sync-notifications";

export function SyncNotifications() {
  useSyncNotifications();
  return null;
}
