"use client";

import { useState } from "react";
import { Check, Database, Download, HardDriveDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/lib/settings-context";
import { useAccessControl } from "@/lib/access-control-context";

export function BackupSection() {
  const { settings, backupHistory, updateBackupConfig, runBackupNow, exportAllData } = useSettings();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("settings.organization", "edit");
  const canExport = canFeature("settings.organization", "manage") || canEdit;

  const [justBackedUp, setJustBackedUp] = useState(false);

  function handleBackupNow() {
    runBackupNow();
    setJustBackedUp(true);
    setTimeout(() => setJustBackedUp(false), 2500);
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Backup &amp; Data Export</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Configure automatic backups and download a full export of this workspace&apos;s data at any time.
      </p>

      <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Automatic Backups</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {settings.backup.autoBackupEnabled
              ? `Running ${settings.backup.frequency.toLowerCase()}, retained for ${settings.backup.retentionDays} days`
              : "Currently disabled"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={settings.backup.autoBackupEnabled}
            disabled={!canEdit}
            onChange={(e) => updateBackupConfig({ autoBackupEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
          />
          Enabled
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Backup Frequency">
          <Select
            value={settings.backup.frequency}
            disabled={!canEdit || !settings.backup.autoBackupEnabled}
            onChange={(e) => updateBackupConfig({ frequency: e.target.value as typeof settings.backup.frequency })}
          >
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </Select>
        </Field>
        <Field label="Retention Period (days)">
          <Select
            value={String(settings.backup.retentionDays)}
            disabled={!canEdit || !settings.backup.autoBackupEnabled}
            onChange={(e) => updateBackupConfig({ retentionDays: Number(e.target.value) })}
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">365 days</option>
          </Select>
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
        {canEdit && (
          <Button type="button" variant="outline" onClick={handleBackupNow}>
            <Database className="h-4 w-4" /> Backup Now
          </Button>
        )}
        {canExport && (
          <Button type="button" onClick={exportAllData}>
            <Download className="h-4 w-4" /> Download Full Export (JSON)
          </Button>
        )}
        {justBackedUp && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Backup created
          </span>
        )}
      </div>

      <div className="mt-8">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <HardDriveDownload className="h-4 w-4" /> Backup History
        </h3>
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th>Size</Th>
            <Th>Triggered By</Th>
          </THead>
          <TBody>
            {backupHistory.map((b) => (
              <Tr key={b.id}>
                <Td>{new Date(b.timestamp).toLocaleString()}</Td>
                <Td>
                  <Badge tone={b.type === "Manual" ? "indigo" : "slate"}>{b.type}</Badge>
                </Td>
                <Td>{b.sizeLabel}</Td>
                <Td>{b.triggeredBy}</Td>
              </Tr>
            ))}
            {backupHistory.length === 0 && <EmptyRow colSpan={4}>No backups recorded yet.</EmptyRow>}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
