"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { orgAuditStore, orgUnitsStore, logOrgAudit } from "@/lib/org-store";
import { orgUnitTypeConfig } from "@/lib/org-data";
import { useAccessControl } from "@/lib/access-control-context";
import type { AccountStatus, OrgAuditEntry, OrgUnit, OrgUnitType } from "@/lib/types";

type OrgUnitDraft = Pick<OrgUnit, "type" | "name" | "code" | "parentId" | "siteId"> &
  Partial<Pick<OrgUnit, "headEmployeeId" | "description" | "locationKind">>;

type OrgUnitEditable = Partial<
  Pick<OrgUnit, "name" | "code" | "parentId" | "siteId" | "headEmployeeId" | "description" | "locationKind">
>;

interface OrgContextValue {
  orgUnits: OrgUnit[];
  auditEntries: OrgAuditEntry[];
  childrenOf: (parentId: string | null, opts?: { type?: OrgUnitType; siteId?: string }) => OrgUnit[];
  descendantIdsOf: (id: string) => Set<string>;
  ancestorsOf: (id: string) => OrgUnit[];
  auditFor: (orgUnitId: string) => OrgAuditEntry[];
  createOrgUnit: (input: OrgUnitDraft) => OrgUnit;
  updateOrgUnit: (id: string, patch: OrgUnitEditable) => void;
  setOrgUnitStatus: (id: string, status: AccountStatus) => void;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const editableFields: (keyof OrgUnitEditable)[] = [
  "name",
  "code",
  "parentId",
  "siteId",
  "headEmployeeId",
  "description",
  "locationKind",
];

export function OrgProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAccessControl();

  const orgUnits = useSyncExternalStore(orgUnitsStore.subscribe, orgUnitsStore.getSnapshot, orgUnitsStore.getServerSnapshot);
  const auditEntries = useSyncExternalStore(orgAuditStore.subscribe, orgAuditStore.getSnapshot, orgAuditStore.getServerSnapshot);

  const childrenOf = useCallback(
    (parentId: string | null, opts?: { type?: OrgUnitType; siteId?: string }) =>
      orgUnits.filter(
        (u) => u.parentId === parentId && (!opts?.type || u.type === opts.type) && (!opts?.siteId || u.siteId === opts.siteId),
      ),
    [orgUnits],
  );

  const descendantIdsOf = useCallback(
    (id: string) => {
      const result = new Set<string>();
      const stack = [id];
      while (stack.length) {
        const current = stack.pop()!;
        for (const u of orgUnits) {
          if (u.parentId === current && !result.has(u.id)) {
            result.add(u.id);
            stack.push(u.id);
          }
        }
      }
      return result;
    },
    [orgUnits],
  );

  const ancestorsOf = useCallback(
    (id: string) => {
      const chain: OrgUnit[] = [];
      let current = orgUnits.find((u) => u.id === id);
      while (current?.parentId) {
        const parent: OrgUnit | undefined = orgUnits.find((u) => u.id === current!.parentId);
        if (!parent) break;
        chain.unshift(parent);
        current = parent;
      }
      return chain;
    },
    [orgUnits],
  );

  const auditFor = useCallback(
    (orgUnitId: string) => auditEntries.filter((e) => e.orgUnitId === orgUnitId),
    [auditEntries],
  );

  const createOrgUnit = useCallback(
    (input: OrgUnitDraft) => {
      const id = `${slugify(input.type)}-${slugify(input.name)}-${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const newUnit: OrgUnit = { ...input, id, status: "Active", createdOn: now, updatedOn: now };
      orgUnitsStore.update((units) => [...units, newUnit]);
      logOrgAudit({
        orgUnitId: id,
        orgUnitType: input.type,
        orgUnitName: input.name,
        action: "created",
        actorName: currentUser.name,
        detail: `${orgUnitTypeConfig[input.type].label} created`,
      });
      return newUnit;
    },
    [currentUser.name],
  );

  const updateOrgUnit = useCallback(
    (id: string, patch: OrgUnitEditable) => {
      const existing = orgUnitsStore.getSnapshot().find((u) => u.id === id);
      if (!existing) return;
      const changed = editableFields.filter((field) => field in patch && patch[field] !== existing[field]);
      if (changed.length === 0) return;
      orgUnitsStore.update((units) =>
        units.map((u) => (u.id === id ? { ...u, ...patch, updatedOn: new Date().toISOString() } : u)),
      );
      logOrgAudit({
        orgUnitId: id,
        orgUnitType: existing.type,
        orgUnitName: patch.name ?? existing.name,
        action: "updated",
        actorName: currentUser.name,
        detail: `Updated ${changed.join(", ")}`,
      });
    },
    [currentUser.name],
  );

  const setOrgUnitStatus = useCallback(
    (id: string, status: AccountStatus) => {
      const existing = orgUnitsStore.getSnapshot().find((u) => u.id === id);
      if (!existing || existing.status === status) return;
      orgUnitsStore.update((units) =>
        units.map((u) => (u.id === id ? { ...u, status, updatedOn: new Date().toISOString() } : u)),
      );
      logOrgAudit({
        orgUnitId: id,
        orgUnitType: existing.type,
        orgUnitName: existing.name,
        action: status === "Active" ? "activated" : "deactivated",
        actorName: currentUser.name,
        detail: `${status === "Active" ? "Activated" : "Deactivated"} ${existing.name}`,
      });
    },
    [currentUser.name],
  );

  const value = useMemo<OrgContextValue>(
    () => ({
      orgUnits,
      auditEntries,
      childrenOf,
      descendantIdsOf,
      ancestorsOf,
      auditFor,
      createOrgUnit,
      updateOrgUnit,
      setOrgUnitStatus,
    }),
    [orgUnits, auditEntries, childrenOf, descendantIdsOf, ancestorsOf, auditFor, createOrgUnit, updateOrgUnit, setOrgUnitStatus],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within an OrgProvider");
  return ctx;
}
