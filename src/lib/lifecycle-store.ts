"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { EmployeeLifecycleEvent } from "@/lib/types";

// Real product starts with zero lifecycle events — see demo-seed.ts for the optional rich dataset.
export const lifecycleEventsStore = createLocalStorageStore<EmployeeLifecycleEvent[]>("hrms_lifecycle_events", []);

export function logLifecycleEvent(entry: Omit<EmployeeLifecycleEvent, "id">) {
  const record: EmployeeLifecycleEvent = {
    ...entry,
    id: `lc-evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  };
  lifecycleEventsStore.update((events) => [record, ...events].slice(0, 1000));
  return record;
}
