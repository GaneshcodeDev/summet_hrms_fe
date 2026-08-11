"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { defaultSettings } from "@/lib/settings-data";
import type { AppSettings, BackupHistoryEntry } from "@/lib/types";

export const settingsStore = createLocalStorageStore<AppSettings>("hrms_app_settings", defaultSettings);

const seedBackupHistory: BackupHistoryEntry[] = [
  {
    id: "backup-seed-1",
    timestamp: new Date(Date.now() - 7 * 24 * 3600e3).toISOString(),
    sizeLabel: "1.8 MB",
    triggeredBy: "System",
    type: "Automatic",
  },
  {
    id: "backup-seed-2",
    timestamp: new Date(Date.now() - 14 * 24 * 3600e3).toISOString(),
    sizeLabel: "1.7 MB",
    triggeredBy: "System",
    type: "Automatic",
  },
];

export const backupHistoryStore = createLocalStorageStore<BackupHistoryEntry[]>("hrms_backup_history", seedBackupHistory);
