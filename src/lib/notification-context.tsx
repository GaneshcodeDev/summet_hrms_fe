"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { notificationsStore, pushNotification } from "@/lib/notification-store";
import { useAccessControl } from "@/lib/access-control-context";
import type { AppNotification, NotificationType } from "@/lib/types";

interface NotifyInput {
  employeeId: string;
  type: NotificationType;
  title: string;
  message: string;
  module: string;
  recordId?: string;
  href?: string;
}

interface NotificationContextValue {
  /** Already scoped to the signed-in user — never another employee's notifications. */
  myNotifications: AppNotification[];
  unreadCount: number;
  notify: (input: NotifyInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAccessControl();
  const all = useSyncExternalStore(notificationsStore.subscribe, notificationsStore.getSnapshot, notificationsStore.getServerSnapshot);

  const myNotifications = useMemo(
    () => all.filter((n) => n.employeeId === currentUser.employeeId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [all, currentUser.employeeId],
  );
  const unreadCount = useMemo(() => myNotifications.filter((n) => !n.read).length, [myNotifications]);

  const notify = useCallback((input: NotifyInput) => {
    pushNotification(input);
  }, []);

  const markRead = useCallback(
    (id: string) => {
      notificationsStore.set(
        notificationsStore.getSnapshot().map((n) => (n.id === id && n.employeeId === currentUser.employeeId ? { ...n, read: true } : n)),
      );
    },
    [currentUser.employeeId],
  );

  const markAllRead = useCallback(() => {
    notificationsStore.set(notificationsStore.getSnapshot().map((n) => (n.employeeId === currentUser.employeeId ? { ...n, read: true } : n)));
  }, [currentUser.employeeId]);

  const value = useMemo<NotificationContextValue>(
    () => ({ myNotifications, unreadCount, notify, markRead, markAllRead }),
    [myNotifications, unreadCount, notify, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
