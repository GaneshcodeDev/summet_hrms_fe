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
import { useEmployees } from "@/lib/employee-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { apiMasterRecordToMasterRecord } from "@/lib/api/mappers";
import {
  createMasterRecord as apiCreateMasterRecord,
  listMasterRecords,
  setMasterRecordStatus as apiSetMasterRecordStatus,
  updateMasterRecord as apiUpdateMasterRecord,
} from "@/lib/api/masters-api";
import { isBackendConnected } from "@/lib/api/token-store";
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
  createRecord: (input: MasterDraft) => Promise<MasterRecord>;
  updateRecord: (id: string, patch: MasterEditable) => Promise<void>;
  setRecordStatus: (id: string, status: AccountStatus) => Promise<void>;
  bulkSetStatus: (ids: string[], status: AccountStatus) => Promise<void>;
  /** CSV bulk import stays local-only — the backend has no bulk-import endpoint this phase. */
  importRecords: (masterType: MasterType, siteId: string | undefined, rows: ImportRow[]) => number;
  /** Call when a page starts viewing a given type — fetches it from the API when connected (see docs/architecture-audit.md). */
  refreshType: (type: MasterType) => Promise<void>;
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
  const { currentSiteId, isAllSites } = useSite();
  const { employees } = useEmployees();

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

  const refreshType = useCallback(
    async (type: MasterType) => {
      if (!isBackendConnected()) return;
      const scope = masterTypeConfig[type].scope;
      const siteId = scope === "tenant" ? (isAllSites ? undefined : currentSiteId) : undefined;
      if (scope === "tenant" && !siteId) return; // no single site selected — nothing valid to fetch

      const apiRecords = await listMasterRecords(type, siteId);
      const mapped = apiRecords.map(apiMasterRecordToMasterRecord);
      masterRecordsStore.set([
        ...masterRecordsStore.getSnapshot().filter((r) => !(r.masterType === type && r.siteId === siteId)),
        ...mapped,
      ]);
    },
    [currentSiteId, isAllSites],
  );

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
    [records, employees],
  );

  const createRecord = useCallback(
    async (input: MasterDraft) => {
      let newRecord: MasterRecord;
      if (isBackendConnected()) {
        const created = await apiCreateMasterRecord({
          masterType: input.masterType,
          name: input.name,
          code: input.code,
          siteId: input.siteId,
          description: input.description,
          attributes: input.attributes,
        });
        newRecord = apiMasterRecordToMasterRecord(created);
      } else {
        const id = `${slugify(input.masterType)}-${slugify(input.name)}-${Date.now().toString(36)}`;
        const now = new Date().toISOString();
        newRecord = { id, status: "Active", attributes: {}, createdOn: now, updatedOn: now, ...input };
      }
      masterRecordsStore.update((rs) => [...rs, newRecord]);
      logMasterAudit({
        masterType: input.masterType,
        recordId: newRecord.id,
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
    async (id: string, patch: MasterEditable) => {
      const existing = masterRecordsStore.getSnapshot().find((r) => r.id === id);
      if (!existing) return;
      const changed = editableFields.filter((field) => field in patch && patch[field] !== existing[field]);
      if (changed.length === 0) return;

      if (isBackendConnected()) {
        const updated = await apiUpdateMasterRecord(id, {
          name: patch.name,
          code: patch.code,
          description: patch.description,
          attributes: patch.attributes,
        });
        const mapped = apiMasterRecordToMasterRecord(updated);
        masterRecordsStore.set(masterRecordsStore.getSnapshot().map((r) => (r.id === id ? mapped : r)));
      } else {
        masterRecordsStore.update((rs) =>
          rs.map((r) => (r.id === id ? { ...r, ...patch, updatedOn: new Date().toISOString() } : r)),
        );
      }

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
    async (id: string, status: AccountStatus) => {
      const existing = masterRecordsStore.getSnapshot().find((r) => r.id === id);
      if (!existing || existing.status === status) return;

      if (isBackendConnected()) {
        const updated = await apiSetMasterRecordStatus(id, status);
        const mapped = apiMasterRecordToMasterRecord(updated);
        masterRecordsStore.set(masterRecordsStore.getSnapshot().map((r) => (r.id === id ? mapped : r)));
      } else {
        masterRecordsStore.update((rs) =>
          rs.map((r) => (r.id === id ? { ...r, status, updatedOn: new Date().toISOString() } : r)),
        );
      }

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
    async (ids: string[], status: AccountStatus) => {
      for (const id of ids) {
        await setRecordStatus(id, status);
      }
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
      refreshType,
    }),
    [
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
      refreshType,
    ],
  );

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>;
}

export function useMasters() {
  const ctx = useContext(MasterContext);
  if (!ctx) throw new Error("useMasters must be used within a MasterProvider");
  return ctx;
}
