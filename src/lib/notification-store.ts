"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { AppNotification } from "@/lib/types";

// Real product starts with zero notifications — nothing to seed, demo or otherwise.
export const notificationsStore = createLocalStorageStore<AppNotification[]>("hrms_notifications", []);

export function pushNotification(input: Omit<AppNotification, "id" | "read" | "createdAt">) {
  const record: AppNotification = {
    ...input,
    id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  // Cap per-recipient growth indirectly by capping the whole list — this is a
  // local prototype store, not a queryable database (see production-readiness doc).
  notificationsStore.update((all) => [record, ...all].slice(0, 500));
  return record;
}
