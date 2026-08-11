"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { backupHistoryStore, settingsStore } from "@/lib/settings-store";
import { useAccessControl } from "@/lib/access-control-context";
import type {
  AppSettings,
  BackupHistoryEntry,
  EmailSettings,
  GeneralSettings,
  LocalizationSettings,
  OrganizationProfileSettings,
} from "@/lib/types";

interface TestEmailResult {
  ok: boolean;
  message: string;
}

interface SettingsContextValue {
  settings: AppSettings;
  backupHistory: BackupHistoryEntry[];
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  updateOrganization: (patch: Partial<OrganizationProfileSettings>) => void;
  updateLocalization: (patch: Partial<LocalizationSettings>) => void;
  updateEmail: (patch: Partial<EmailSettings>) => void;
  toggleNotification: (key: string) => void;
  toggleIntegration: (id: string) => void;
  updateBackupConfig: (patch: Partial<AppSettings["backup"]>) => void;
  runBackupNow: () => BackupHistoryEntry;
  exportAllData: () => void;
  sendTestEmail: () => TestEmailResult;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAccessControl();

  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.getSnapshot, settingsStore.getServerSnapshot);
  const backupHistory = useSyncExternalStore(
    backupHistoryStore.subscribe,
    backupHistoryStore.getSnapshot,
    backupHistoryStore.getServerSnapshot,
  );

  const updateGeneral = useCallback((patch: Partial<GeneralSettings>) => {
    settingsStore.update((s) => ({ ...s, general: { ...s.general, ...patch } }));
  }, []);

  const updateOrganization = useCallback((patch: Partial<OrganizationProfileSettings>) => {
    settingsStore.update((s) => ({ ...s, organization: { ...s.organization, ...patch } }));
  }, []);

  const updateLocalization = useCallback((patch: Partial<LocalizationSettings>) => {
    settingsStore.update((s) => ({ ...s, localization: { ...s.localization, ...patch } }));
  }, []);

  const updateEmail = useCallback((patch: Partial<EmailSettings>) => {
    settingsStore.update((s) => ({ ...s, email: { ...s.email, ...patch } }));
  }, []);

  const toggleNotification = useCallback((key: string) => {
    settingsStore.update((s) => ({
      ...s,
      email: { ...s.email, notifications: { ...s.email.notifications, [key]: !s.email.notifications[key] } },
    }));
  }, []);

  const toggleIntegration = useCallback((id: string) => {
    settingsStore.update((s) => ({ ...s, integrations: { ...s.integrations, [id]: !s.integrations[id] } }));
  }, []);

  const updateBackupConfig = useCallback((patch: Partial<AppSettings["backup"]>) => {
    settingsStore.update((s) => ({ ...s, backup: { ...s.backup, ...patch } }));
  }, []);

  const runBackupNow = useCallback(() => {
    const sizeKb = Object.keys(localStorage)
      .filter((k) => k.startsWith("hrms_"))
      .reduce((sum, k) => sum + (localStorage.getItem(k)?.length ?? 0), 0) / 1024;
    const entry: BackupHistoryEntry = {
      id: `backup-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sizeLabel: `${sizeKb.toFixed(1)} KB`,
      triggeredBy: currentUser.name,
      type: "Manual",
    };
    backupHistoryStore.update((history) => [entry, ...history].slice(0, 50));
    settingsStore.update((s) => ({ ...s, backup: { ...s.backup, lastBackupAt: entry.timestamp } }));
    return entry;
  }, [currentUser.name]);

  const exportAllData = useCallback(() => {
    const snapshot: Record<string, unknown> = {};
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("hrms_")) continue;
      try {
        snapshot[key] = JSON.parse(localStorage.getItem(key) ?? "null");
      } catch {
        snapshot[key] = localStorage.getItem(key);
      }
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.name,
      data: snapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hrms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [currentUser.name]);

  const sendTestEmail = useCallback((): TestEmailResult => {
    if (!settings.email.smtpHost || !settings.email.fromEmail) {
      return { ok: false, message: "Set an SMTP host and From Email before sending a test email." };
    }
    return {
      ok: true,
      message: `Test email queued to ${currentUser.account?.email ?? "your inbox"} (demo environment — no SMTP server is actually connected).`,
    };
  }, [settings.email.smtpHost, settings.email.fromEmail, currentUser.account?.email]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      backupHistory,
      updateGeneral,
      updateOrganization,
      updateLocalization,
      updateEmail,
      toggleNotification,
      toggleIntegration,
      updateBackupConfig,
      runBackupNow,
      exportAllData,
      sendTestEmail,
    }),
    [
      settings,
      backupHistory,
      updateGeneral,
      updateOrganization,
      updateLocalization,
      updateEmail,
      toggleNotification,
      toggleIntegration,
      updateBackupConfig,
      runBackupNow,
      exportAllData,
      sendTestEmail,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
