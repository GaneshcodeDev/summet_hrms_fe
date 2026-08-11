"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { masterAuditStore, masterRecordsStore, logMasterAudit } from "@/lib/master-store";
import { masterTypeConfig } from "@/lib/master-data";
import { employees } from "@/lib/mock-data";
import { useAccessControl } from "@/lib/access-control-context";
import type { AccountStatus, MasterAttributes, MasterAuditEntry, MasterRecord, MasterType } from "@/lib/types";

type MasterDraft = {
  masterType: MasterType;
  name: string;
  code: string;
  siteId?: string;
  description?: string;
  attributes?: MasterAttributes;
};

type MasterEditable = Partial<Pick<MasterRecord, "name" | "code" | "siteId" | "description" | "attributes">>;

interface ImportRow {
  name: string;
  code: string;
  description?: string;
  attributes?: MasterAttributes;
}

interface MasterContextValue {
  records: MasterRecord[];
  auditEntries: MasterAuditEntry[];
  recordsOfType: (type: MasterType) => MasterRecord[];
  auditFor: (recordId: string) => MasterAuditEntry[];
  dependentsCount: (record: MasterRecord) => number;
  createRecord: (input: MasterDraft) => MasterRecord;
  updateRecord: (id: string, patch: MasterEditable) => void;
  setRecordStatus: (id: string, status: AccountStatus) => void;
  bulkSetStatus: (ids: string[], status: AccountStatus) => void;
  importRecords: (masterType: MasterType, siteId: string | undefined, rows: ImportRow[]) => number;
}

const MasterContext = createContext<MasterContextValue | undefined>(undefined);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const editableFields: (keyof MasterEditable)[] = ["name", "code", "siteId", "description", "attributes"];

export function MasterProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAccessControl();

  const records = useSyncExternalStore(
    masterRecordsStore.subscribe,
    masterRecordsStore.getSnapshot,
    masterRecordsStore.getServerSnapshot,
  );
  const auditEntries = useSyncExternalStore(
    masterAuditStore.subscribe,
    masterAuditStore.getSnapshot,
    masterAuditStore.getServerSnapshot,
  );

  const recordsOfType = useCallback((type: MasterType) => records.filter((r) => r.masterType === type), [records]);

  const auditFor = useCallback(
    (recordId: string) => auditEntries.filter((e) => e.recordId === recordId),
    [auditEntries],
  );

  /**
   * Generic dependency check: counts other master records whose attributes
   * reference this record's id (e.g. a Shift pointing at this Shift Type),
   * plus — for Designation specifically — employees currently holding it.
   * Surfaced as a warning before deactivating; never blocks (there is no
   * hard delete anywhere in this module, only activate/deactivate).
   */
  const dependentsCount = useCallback(
    (record: MasterRecord) => {
      const referencingRecords = records.filter(
        (r) => r.id !== record.id && Object.values(r.attributes).some((v) => v === record.id),
      ).length;
      const referencingEmployees =
        record.masterType === "Designation" ? employees.filter((e) => e.designation === record.name).length : 0;
      return referencingRecords + referencingEmployees;
    },
    [records],
  );

  const createRecord = useCallback(
    (input: MasterDraft) => {
      const id = `${slugify(input.masterType)}-${slugify(input.name)}-${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const newRecord: MasterRecord = {
        id,
        status: "Active",
        attributes: {},
        createdOn: now,
        updatedOn: now,
        ...input,
      };
      masterRecordsStore.update((rs) => [...rs, newRecord]);
      logMasterAudit({
        masterType: input.masterType,
        recordId: id,
        recordName: input.name,
        action: "created",
        actorName: currentUser.name,
        detail: `${masterTypeConfig[input.masterType].label} created`,
      });
      return newRecord;
    },
    [currentUser.name],
  );

  const updateRecord = useCallback(
    (id: string, patch: MasterEditable) => {
      const existing = masterRecordsStore.getSnapshot().find((r) => r.id === id);
      if (!existing) return;
      const changed = editableFields.filter((field) => field in patch && patch[field] !== existing[field]);
      if (changed.length === 0) return;
      masterRecordsStore.update((rs) =>
        rs.map((r) => (r.id === id ? { ...r, ...patch, updatedOn: new Date().toISOString() } : r)),
      );
      logMasterAudit({
        masterType: existing.masterType,
        recordId: id,
        recordName: patch.name ?? existing.name,
        action: "updated",
        actorName: currentUser.name,
        detail: `Updated ${changed.join(", ")}`,
      });
    },
    [currentUser.name],
  );

  const setRecordStatus = useCallback(
    (id: string, status: AccountStatus) => {
      const existing = masterRecordsStore.getSnapshot().find((r) => r.id === id);
      if (!existing || existing.status === status) return;
      masterRecordsStore.update((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status, updatedOn: new Date().toISOString() } : r)),
      );
      logMasterAudit({
        masterType: existing.masterType,
        recordId: id,
        recordName: existing.name,
        action: status === "Active" ? "activated" : "deactivated",
        actorName: currentUser.name,
        detail: `${status === "Active" ? "Activated" : "Deactivated"} ${existing.name}`,
      });
    },
    [currentUser.name],
  );

  const bulkSetStatus = useCallback(
    (ids: string[], status: AccountStatus) => {
      ids.forEach((id) => setRecordStatus(id, status));
    },
    [setRecordStatus],
  );

  const importRecords = useCallback(
    (masterType: MasterType, siteId: string | undefined, rows: ImportRow[]) => {
      const now = new Date().toISOString();
      const newRecords: MasterRecord[] = rows.map((row, i) => ({
        id: `${slugify(masterType)}-${slugify(row.name)}-${Date.now().toString(36)}-${i}`,
        masterType,
        name: row.name,
        code: row.code,
        siteId,
        description: row.description,
        status: "Active",
        attributes: row.attributes ?? {},
        createdOn: now,
        updatedOn: now,
      }));
      if (newRecords.length === 0) return 0;
      masterRecordsStore.update((rs) => [...rs, ...newRecords]);
      logMasterAudit({
        masterType,
        recordId: newRecords[0].id,
        recordName: `${newRecords.length} record${newRecords.length === 1 ? "" : "s"}`,
        action: "imported",
        actorName: currentUser.name,
        detail: `Imported ${newRecords.length} ${masterTypeConfig[masterType].pluralLabel.toLowerCase()} via CSV`,
      });
      return newRecords.length;
    },
    [currentUser.name],
  );

  const value = useMemo<MasterContextValue>(
    () => ({
      records,
      auditEntries,
      recordsOfType,
      auditFor,
      dependentsCount,
      createRecord,
      updateRecord,
      setRecordStatus,
      bulkSetStatus,
      importRecords,
    }),
    [records, auditEntries, recordsOfType, auditFor, dependentsCount, createRecord, updateRecord, setRecordStatus, bulkSetStatus, importRecords],
  );

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>;
}

export function useMasters() {
  const ctx = useContext(MasterContext);
  if (!ctx) throw new Error("useMasters must be used within a MasterProvider");
  return ctx;
}
