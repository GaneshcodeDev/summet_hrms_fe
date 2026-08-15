"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { ApprovalInstance } from "@/lib/types";

/**
 * Plain (non-React) persistence for approval workflow instances, mirroring
 * leave-store.ts / regularization-store.ts. Every module that opts into the
 * reusable workflow (see approval-context.tsx) writes here; each instance
 * carries its own module + recordId + siteId so instances from different
 * modules/sites can safely share one store without colliding.
 */
export const approvalInstancesStore = createLocalStorageStore<ApprovalInstance[]>("hrms_approval_instances", []);

export function findApprovalInstance(module: string, recordId: string): ApprovalInstance | undefined {
  return approvalInstancesStore.getSnapshot().find((i) => i.module === module && i.recordId === recordId);
}

/**
 * Minimal event-hook abstraction for future notification integration
 * (email/SMS/push) — deliberately not wired to send anything yet. A future
 * phase can call `approvalEvents.on(...)` to subscribe without touching any
 * approval logic here.
 */
export type ApprovalEventName = "onApprovalRequested" | "onApprovalApproved" | "onApprovalRejected" | "onApprovalCancelled";

type ApprovalEventListener = (instance: ApprovalInstance) => void;

function createApprovalEventBus() {
  const listeners = new Map<ApprovalEventName, Set<ApprovalEventListener>>();
  return {
    on(event: ApprovalEventName, listener: ApprovalEventListener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
    emit(event: ApprovalEventName, instance: ApprovalInstance) {
      listeners.get(event)?.forEach((listener) => listener(instance));
    },
  };
}

export const approvalEvents = createApprovalEventBus();
