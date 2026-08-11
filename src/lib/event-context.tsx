"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { eventsStore } from "@/lib/event-store";
import { useAccessControl } from "@/lib/access-control-context";
import type { CompanyEvent, EventStatus, EventType } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface EventDraft {
  title: string;
  description: string;
  type: EventType;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: string;
  siteId?: string;
  roleIds: string[];
}

interface EventContextValue {
  events: CompanyEvent[];
  /** Events the signed-in user is allowed to see, based on their roles (empty roleIds on an event = visible to all). */
  visibleEvents: () => CompanyEvent[];
  canManageEvents: boolean;
  createEvent: (input: EventDraft) => ActionResult;
  updateEvent: (id: string, patch: Partial<EventDraft>) => ActionResult;
  cancelEvent: (id: string) => ActionResult;
  deleteEvent: (id: string) => ActionResult;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature, isSuperAdmin } = useAccessControl();

  const events = useSyncExternalStore(eventsStore.subscribe, eventsStore.getSnapshot, eventsStore.getServerSnapshot);

  const canManageEvents = canFeature("events.calendar", "create") || canFeature("events.calendar", "manage");

  const myRoleIds = useMemo(() => currentUser.roles.map((r) => r.id), [currentUser.roles]);

  const visibleEvents = useCallback(
    () =>
      isSuperAdmin
        ? events
        : events.filter((e) => e.roleIds.length === 0 || e.roleIds.some((r) => myRoleIds.includes(r))),
    [events, myRoleIds, isSuperAdmin],
  );

  const createEvent = useCallback(
    (input: EventDraft): ActionResult => {
      if (!canFeature("events.calendar", "create") && !canFeature("events.calendar", "manage")) {
        return { ok: false, message: "You're not authorized to create events." };
      }
      const event: CompanyEvent = {
        id: `evt-${Date.now().toString(36)}`,
        ...input,
        status: "Scheduled",
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      eventsStore.set([event, ...eventsStore.getSnapshot()]);
      return { ok: true, message: `${input.title} created.` };
    },
    [canFeature, currentUser.name],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<EventDraft>): ActionResult => {
      if (!canFeature("events.calendar", "edit") && !canFeature("events.calendar", "manage")) {
        return { ok: false, message: "You're not authorized to edit events." };
      }
      const existing = eventsStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Event not found." };
      eventsStore.set(eventsStore.getSnapshot().map((e) => (e.id === id ? { ...e, ...patch } : e)));
      return { ok: true, message: "Event updated." };
    },
    [canFeature],
  );

  const setStatus = useCallback(
    (id: string, status: EventStatus): ActionResult => {
      const existing = eventsStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Event not found." };
      if (!canFeature("events.calendar", "edit") && !canFeature("events.calendar", "manage")) {
        return { ok: false, message: "You're not authorized to update this event." };
      }
      eventsStore.set(eventsStore.getSnapshot().map((e) => (e.id === id ? { ...e, status } : e)));
      return { ok: true, message: status === "Cancelled" ? `${existing.title} cancelled.` : "Event updated." };
    },
    [canFeature],
  );

  const cancelEvent = useCallback((id: string) => setStatus(id, "Cancelled"), [setStatus]);

  const deleteEvent = useCallback(
    (id: string): ActionResult => {
      const existing = eventsStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Event not found." };
      if (!canFeature("events.calendar", "delete") && !canFeature("events.calendar", "manage")) {
        return { ok: false, message: "You're not authorized to delete events." };
      }
      eventsStore.set(eventsStore.getSnapshot().filter((e) => e.id !== id));
      return { ok: true, message: `${existing.title} deleted.` };
    },
    [canFeature],
  );

  const value = useMemo<EventContextValue>(
    () => ({ events, visibleEvents, canManageEvents, createEvent, updateEvent, cancelEvent, deleteEvent }),
    [events, visibleEvents, canManageEvents, createEvent, updateEvent, cancelEvent, deleteEvent],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvents must be used within an EventProvider");
  return ctx;
}
