"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { employeeSiteMappingsStore, siteProfilesStore } from "@/lib/site-profile-store";
import { useEmployees } from "@/lib/employee-context";
import { useAccessControl } from "@/lib/access-control-context";
import type { Employee, EmployeeSiteMapping, SiteHoliday, SiteProfile, SiteShift } from "@/lib/types";

function blankProfile(orgUnitId: string): SiteProfile {
  return {
    orgUnitId,
    category: "",
    currency: "INR",
    segment: "",
    subSegment: "",
    assetBarcodePrefix: "",
    activationDateTime: "",
    address: { line1: "", city: "", state: "", pincode: "", country: "India" },
    contact: { name: "", phone: "", email: "" },
    physicalLocationNote: "",
    roleIds: [],
    shifts: [],
    holidays: [],
  };
}

interface SiteProfileContextValue {
  siteProfiles: SiteProfile[];
  employeeSiteMappings: EmployeeSiteMapping[];
  profileFor: (orgUnitId: string) => SiteProfile;
  updateProfile: (orgUnitId: string, patch: Partial<Omit<SiteProfile, "orgUnitId">>) => void;
  addShift: (orgUnitId: string, shift: Omit<SiteShift, "id">) => void;
  removeShift: (orgUnitId: string, shiftId: string) => void;
  addHoliday: (orgUnitId: string, holiday: Omit<SiteHoliday, "id">) => void;
  removeHoliday: (orgUnitId: string, holidayId: string) => void;
  employeesMappedTo: (orgUnitId: string, field: "costCenterId" | "profitCenterId") => Employee[];
  setEmployeeMapping: (employeeId: string, field: "costCenterId" | "profitCenterId", orgUnitId: string | null) => void;
}

const SiteProfileContext = createContext<SiteProfileContextValue | undefined>(undefined);

export function SiteProfileProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();

  const siteProfiles = useSyncExternalStore(
    siteProfilesStore.subscribe,
    siteProfilesStore.getSnapshot,
    siteProfilesStore.getServerSnapshot,
  );
  const employeeSiteMappings = useSyncExternalStore(
    employeeSiteMappingsStore.subscribe,
    employeeSiteMappingsStore.getSnapshot,
    employeeSiteMappingsStore.getServerSnapshot,
  );

  const profileFor = useCallback(
    (orgUnitId: string) => siteProfiles.find((p) => p.orgUnitId === orgUnitId) ?? blankProfile(orgUnitId),
    [siteProfiles],
  );

  const upsert = useCallback(
    (orgUnitId: string, patch: Partial<Omit<SiteProfile, "orgUnitId">>) => {
      const existing = siteProfilesStore.getSnapshot().find((p) => p.orgUnitId === orgUnitId) ?? blankProfile(orgUnitId);
      const next: SiteProfile = {
        ...existing,
        ...patch,
        updatedBy: currentUser.name,
        updatedOn: new Date().toISOString(),
      };
      const rest = siteProfilesStore.getSnapshot().filter((p) => p.orgUnitId !== orgUnitId);
      siteProfilesStore.set([...rest, next]);
    },
    [currentUser.name],
  );

  const updateProfile = useCallback(
    (orgUnitId: string, patch: Partial<Omit<SiteProfile, "orgUnitId">>) => upsert(orgUnitId, patch),
    [upsert],
  );

  const addShift = useCallback(
    (orgUnitId: string, shift: Omit<SiteShift, "id">) => {
      const existing = siteProfilesStore.getSnapshot().find((p) => p.orgUnitId === orgUnitId) ?? blankProfile(orgUnitId);
      upsert(orgUnitId, { shifts: [...existing.shifts, { ...shift, id: `shift-${Date.now().toString(36)}` }] });
    },
    [upsert],
  );

  const removeShift = useCallback(
    (orgUnitId: string, shiftId: string) => {
      const existing = siteProfilesStore.getSnapshot().find((p) => p.orgUnitId === orgUnitId) ?? blankProfile(orgUnitId);
      upsert(orgUnitId, { shifts: existing.shifts.filter((s) => s.id !== shiftId) });
    },
    [upsert],
  );

  const addHoliday = useCallback(
    (orgUnitId: string, holiday: Omit<SiteHoliday, "id">) => {
      const existing = siteProfilesStore.getSnapshot().find((p) => p.orgUnitId === orgUnitId) ?? blankProfile(orgUnitId);
      upsert(orgUnitId, { holidays: [...existing.holidays, { ...holiday, id: `hol-${Date.now().toString(36)}` }] });
    },
    [upsert],
  );

  const removeHoliday = useCallback(
    (orgUnitId: string, holidayId: string) => {
      const existing = siteProfilesStore.getSnapshot().find((p) => p.orgUnitId === orgUnitId) ?? blankProfile(orgUnitId);
      upsert(orgUnitId, { holidays: existing.holidays.filter((h) => h.id !== holidayId) });
    },
    [upsert],
  );

  const employeesMappedTo = useCallback(
    (orgUnitId: string, field: "costCenterId" | "profitCenterId") => {
      const overrides = new Map(employeeSiteMappings.map((m) => [m.employeeId, m]));
      return employees.filter((e) => {
        const mapping = overrides.get(e.employeeId);
        const value = mapping ? mapping[field] : e[field];
        return value === orgUnitId;
      });
    },
    [employeeSiteMappings, employees],
  );

  const setEmployeeMapping = useCallback(
    (employeeId: string, field: "costCenterId" | "profitCenterId", orgUnitId: string | null) => {
      const base = employees.find((e) => e.employeeId === employeeId);
      const existing = employeeSiteMappingsStore.getSnapshot().find((m) => m.employeeId === employeeId);
      const next: EmployeeSiteMapping = {
        employeeId,
        costCenterId: existing?.costCenterId ?? base?.costCenterId,
        profitCenterId: existing?.profitCenterId ?? base?.profitCenterId,
        ...existing,
        [field]: orgUnitId ?? undefined,
        updatedBy: currentUser.name,
        updatedOn: new Date().toISOString(),
      };
      const rest = employeeSiteMappingsStore.getSnapshot().filter((m) => m.employeeId !== employeeId);
      employeeSiteMappingsStore.set([...rest, next]);
    },
    [currentUser.name, employees],
  );

  const value = useMemo<SiteProfileContextValue>(
    () => ({
      siteProfiles,
      employeeSiteMappings,
      profileFor,
      updateProfile,
      addShift,
      removeShift,
      addHoliday,
      removeHoliday,
      employeesMappedTo,
      setEmployeeMapping,
    }),
    [
      siteProfiles,
      employeeSiteMappings,
      profileFor,
      updateProfile,
      addShift,
      removeShift,
      addHoliday,
      removeHoliday,
      employeesMappedTo,
      setEmployeeMapping,
    ],
  );

  return <SiteProfileContext.Provider value={value}>{children}</SiteProfileContext.Provider>;
}

export function useSiteProfile() {
  const ctx = useContext(SiteProfileContext);
  if (!ctx) throw new Error("useSiteProfile must be used within a SiteProfileProvider");
  return ctx;
}
