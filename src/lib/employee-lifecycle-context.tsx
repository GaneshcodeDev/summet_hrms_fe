"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { lifecycleEventsStore, logLifecycleEvent } from "@/lib/lifecycle-store";
import { wouldCreateReportingCycle } from "@/lib/employee-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useSite } from "@/lib/site-context";
import { useApprovals } from "@/lib/approval-context";
import type { EmployeeEditable } from "@/lib/employee-context";
import type { EmployeeLifecycleEvent } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface ConfirmInput {
  confirmationDate: string;
  comment?: string;
}

interface TransferInput {
  siteId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  plantId?: string;
  locationId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  reportingManagerId?: string;
  effectiveDate: string;
  comment?: string;
}

interface PromoteInput {
  designationId?: string;
  gradeId?: string;
  designationLabel?: string;
  effectiveDate: string;
  comment?: string;
}

interface EmployeeLifecycleContextValue {
  events: EmployeeLifecycleEvent[];
  eventsForEmployee: (employeeId: string) => EmployeeLifecycleEvent[];
  canManageLifecycle: boolean;
  canTransferCrossSite: boolean;
  confirmEmployee: (employeeId: string, input: ConfirmInput) => ActionResult;
  transferEmployee: (employeeId: string, input: TransferInput) => ActionResult;
  promoteEmployee: (employeeId: string, input: PromoteInput) => ActionResult;
  changeManager: (employeeId: string, newManagerEmployeeId: string, comment?: string) => ActionResult;
  changeShift: (employeeId: string, newShiftId: string, effectiveDate: string, comment?: string) => ActionResult;
}

const EmployeeLifecycleContext = createContext<EmployeeLifecycleContextValue | undefined>(undefined);

export function EmployeeLifecycleProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature, isSuperAdmin } = useAccessControl();
  const { getEmployeeById, getEmployeeByEmployeeId, updateEmployee } = useEmployees();
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();
  const { sites } = useSite();
  const { recordMirroredAction } = useApprovals();

  const events = useSyncExternalStore(lifecycleEventsStore.subscribe, lifecycleEventsStore.getSnapshot, lifecycleEventsStore.getServerSnapshot);

  const canManageLifecycle = canFeature("employees.lifecycle", "edit") || canFeature("employees.lifecycle", "manage");
  // Changing which SITE an employee belongs to is the one lifecycle action
  // pinned to Super Admin only — every other role in this app (Site Admin,
  // HR Admin included) is structurally scoped to a single site by
  // site-context.tsx's effectiveSiteId, so letting them move an employee OUT
  // of that site would be the one place RBAC alone doesn't already contain
  // the blast radius (AGENTS.md Phase 12 section 26).
  const canTransferCrossSite = isSuperAdmin;

  const eventsForEmployee = useCallback((employeeId: string) => events.filter((e) => e.employeeId === employeeId), [events]);

  const logEvent = useCallback(
    (input: Omit<EmployeeLifecycleEvent, "id" | "actorName" | "date"> & { date?: string }) => {
      return logLifecycleEvent({
        ...input,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        actorName: currentUser.name,
      });
    },
    [currentUser.name],
  );

  const mirror = useCallback(
    (recordId: string, siteId: string, comment?: string) => {
      recordMirroredAction({
        siteId,
        module: "Employee",
        recordId,
        recordOwnerEmployeeId: currentUser.employeeId,
        recordOwnerName: currentUser.name,
        approverType: "HR",
        action: "APPROVE",
        newStatus: "Approved",
        comment,
      });
    },
    [recordMirroredAction, currentUser.employeeId, currentUser.name],
  );

  const confirmEmployee = useCallback(
    (employeeId: string, input: ConfirmInput): ActionResult => {
      if (!canManageLifecycle) return { ok: false, message: "You're not authorized to confirm employees." };
      const employee = getEmployeeById(employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      if (employee.employmentStage === "Confirmed") return { ok: false, message: `${employee.name} is already confirmed.` };
      if (employee.employmentStage === "Exited") return { ok: false, message: `${employee.name} has already exited.` };
      const previousStage = employee.employmentStage ?? "Probation";
      const result = updateEmployee(employee.id, { employmentStage: "Confirmed", confirmationDate: input.confirmationDate } as EmployeeEditable);
      if (!result.ok) return result;
      logEvent({
        employeeId: employee.employeeId,
        siteId: employee.siteId,
        eventType: "Confirmed",
        previousValue: previousStage,
        newValue: "Confirmed",
        comment: input.comment,
        date: input.confirmationDate,
      });
      mirror(`confirm-${employee.employeeId}-${input.confirmationDate}`, employee.siteId, input.comment);
      return { ok: true, message: `${employee.name} confirmed effective ${input.confirmationDate}.` };
    },
    [canManageLifecycle, getEmployeeById, updateEmployee, logEvent, mirror],
  );

  const transferEmployee = useCallback(
    (employeeId: string, input: TransferInput): ActionResult => {
      if (!canManageLifecycle) return { ok: false, message: "You're not authorized to transfer employees." };
      const employee = getEmployeeById(employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };

      const targetSiteId = input.siteId ?? employee.siteId;
      const siteChanging = targetSiteId !== employee.siteId;
      if (siteChanging && !canTransferCrossSite) {
        return { ok: false, message: "Only a Super Admin can transfer an employee to a different site." };
      }
      const targetSite = sites.find((s) => s.id === targetSiteId);
      if (!targetSite) return { ok: false, message: "Target site not found." };

      // Validate every provided org/master id actually belongs to the target site.
      const belongsToSite = (id: string | undefined, pool: { id: string; siteId?: string }[], label: string): string | null => {
        if (!id) return null;
        const record = pool.find((r) => r.id === id);
        if (!record) return `${label} not found.`;
        if (record.siteId && record.siteId !== targetSiteId) return `${label} does not belong to ${targetSite.name}.`;
        return null;
      };
      const orgError =
        belongsToSite(input.departmentId, orgUnits, "Department") ||
        belongsToSite(input.subDepartmentId, orgUnits, "Sub Department") ||
        belongsToSite(input.plantId, orgUnits, "Plant") ||
        belongsToSite(input.locationId, orgUnits, "Location") ||
        belongsToSite(input.costCenterId, orgUnits, "Cost Center") ||
        belongsToSite(input.profitCenterId, orgUnits, "Profit Center");
      if (orgError) return { ok: false, message: orgError };

      if (input.reportingManagerId) {
        const manager = getEmployeeByEmployeeId(input.reportingManagerId);
        if (!manager) return { ok: false, message: "Target manager not found." };
        if (manager.siteId !== targetSiteId) return { ok: false, message: `Target manager does not belong to ${targetSite.name}.` };
        if (manager.status !== "Active") return { ok: false, message: "Target manager is not active." };
        if (manager.employeeId === employee.employeeId) return { ok: false, message: "An employee can't be their own reporting manager." };
        if (wouldCreateReportingCycle(employee.employeeId, input.reportingManagerId)) {
          return { ok: false, message: "That would create a reporting loop — choose a different manager." };
        }
      }

      // Stale-id guard (section 6): if the site is changing and a field
      // wasn't explicitly re-targeted, clear it rather than leave a Site A
      // id dangling on a Site B employee.
      const patch: EmployeeEditable = { siteId: targetSiteId };
      const fields: Array<[string, string | undefined]> = [
        ["departmentId", input.departmentId],
        ["subDepartmentId", input.subDepartmentId],
        ["plantId", input.plantId],
        ["locationId", input.locationId],
        ["costCenterId", input.costCenterId],
        ["profitCenterId", input.profitCenterId],
      ];
      const events_: Array<{ eventType: EmployeeLifecycleEvent["eventType"]; previousValue?: string; newValue?: string }> = [];
      for (const [key, value] of fields) {
        if (value !== undefined) {
          (patch as Record<string, unknown>)[key] = value;
        } else if (siteChanging) {
          (patch as Record<string, unknown>)[key] = undefined;
        }
      }
      if (input.reportingManagerId !== undefined) patch.reportingManagerId = input.reportingManagerId;

      if (siteChanging) {
        events_.push({ eventType: "Site Changed", previousValue: sites.find((s) => s.id === employee.siteId)?.name, newValue: targetSite.name });
      }
      if (input.departmentId && input.departmentId !== employee.departmentId) {
        events_.push({
          eventType: "Department Changed",
          previousValue: orgUnits.find((u) => u.id === employee.departmentId)?.name,
          newValue: orgUnits.find((u) => u.id === input.departmentId)?.name,
        });
      }
      if (input.reportingManagerId && input.reportingManagerId !== employee.reportingManagerId) {
        events_.push({
          eventType: "Manager Changed",
          previousValue: employee.reportingManagerId ? getEmployeeByEmployeeId(employee.reportingManagerId)?.name : undefined,
          newValue: getEmployeeByEmployeeId(input.reportingManagerId)?.name,
        });
      }
      if (events_.length === 0) return { ok: false, message: "No change to apply — pick at least one target field." };

      const result = updateEmployee(employee.id, patch);
      if (!result.ok) return result;

      for (const e of events_) {
        logEvent({ employeeId: employee.employeeId, siteId: targetSiteId, ...e, comment: input.comment, date: input.effectiveDate });
      }
      // The overall action is always also logged as a single "Transferred" summary event, even when only one field moved.
      logEvent({
        employeeId: employee.employeeId,
        siteId: targetSiteId,
        eventType: "Transferred",
        previousValue: sites.find((s) => s.id === employee.siteId)?.name,
        newValue: targetSite.name,
        comment: input.comment,
        date: input.effectiveDate,
      });
      mirror(`transfer-${employee.employeeId}-${input.effectiveDate}`, targetSiteId, input.comment);
      return { ok: true, message: `${employee.name} transferred effective ${input.effectiveDate}.` };
    },
    [canManageLifecycle, canTransferCrossSite, getEmployeeById, getEmployeeByEmployeeId, updateEmployee, orgUnits, sites, logEvent, mirror],
  );

  const promoteEmployee = useCallback(
    (employeeId: string, input: PromoteInput): ActionResult => {
      if (!canManageLifecycle) return { ok: false, message: "You're not authorized to promote employees." };
      const employee = getEmployeeById(employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      if (!input.designationId && !input.gradeId) return { ok: false, message: "A new designation or grade is required." };

      const newDesignationName = input.designationId ? masterRecords.find((m) => m.id === input.designationId)?.name : undefined;
      const patch: EmployeeEditable = {};
      if (input.designationId) {
        patch.designationId = input.designationId;
        if (newDesignationName) patch.designation = newDesignationName;
      }
      if (input.gradeId) patch.gradeId = input.gradeId;

      const result = updateEmployee(employee.id, patch);
      if (!result.ok) return result;

      logEvent({
        employeeId: employee.employeeId,
        siteId: employee.siteId,
        eventType: "Promoted",
        previousValue: employee.designation,
        newValue: newDesignationName ?? employee.designation,
        comment: input.comment,
        date: input.effectiveDate,
      });
      mirror(`promote-${employee.employeeId}-${input.effectiveDate}`, employee.siteId, input.comment);
      return { ok: true, message: `${employee.name} promoted effective ${input.effectiveDate}.` };
    },
    [canManageLifecycle, getEmployeeById, updateEmployee, masterRecords, logEvent, mirror],
  );

  const changeManager = useCallback(
    (employeeId: string, newManagerEmployeeId: string, comment?: string): ActionResult => {
      if (!canManageLifecycle) return { ok: false, message: "You're not authorized to change reporting managers." };
      const employee = getEmployeeById(employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      const manager = getEmployeeByEmployeeId(newManagerEmployeeId);
      if (!manager) return { ok: false, message: "New manager not found." };
      if (manager.siteId !== employee.siteId) return { ok: false, message: "New manager must be at the same site." };
      if (manager.status !== "Active") return { ok: false, message: "New manager is not active." };
      if (manager.employeeId === employee.employeeId) return { ok: false, message: "An employee can't be their own reporting manager." };
      if (wouldCreateReportingCycle(employee.employeeId, newManagerEmployeeId)) {
        return { ok: false, message: "That would create a reporting loop — choose a different manager." };
      }
      const previousManager = employee.reportingManagerId ? getEmployeeByEmployeeId(employee.reportingManagerId) : undefined;
      const result = updateEmployee(employee.id, { reportingManagerId: newManagerEmployeeId });
      if (!result.ok) return result;
      logEvent({
        employeeId: employee.employeeId,
        siteId: employee.siteId,
        eventType: "Manager Changed",
        previousValue: previousManager?.name,
        newValue: manager.name,
        comment,
      });
      mirror(`manager-${employee.employeeId}-${Date.now()}`, employee.siteId, comment);
      return { ok: true, message: `${employee.name}'s reporting manager changed to ${manager.name}.` };
    },
    [canManageLifecycle, getEmployeeById, getEmployeeByEmployeeId, updateEmployee, logEvent, mirror],
  );

  const changeShift = useCallback(
    (employeeId: string, newShiftId: string, effectiveDate: string, comment?: string): ActionResult => {
      if (!canManageLifecycle) return { ok: false, message: "You're not authorized to change shifts." };
      const employee = getEmployeeById(employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      const shift = masterRecords.find((m) => m.id === newShiftId && m.masterType === "Shift");
      if (!shift) return { ok: false, message: "Shift not found." };
      if (shift.siteId && shift.siteId !== employee.siteId) return { ok: false, message: "That shift does not belong to the employee's site." };
      const previousShift = employee.shiftId ? masterRecords.find((m) => m.id === employee.shiftId)?.name : undefined;
      // Future-effective only — this changes the employee's CURRENT shift
      // assignment; already-recorded AttendanceRecord.shiftId values for past
      // dates are untouched (Phase 12 section 13), since attendance is
      // written once at mark-time and never re-derived from the employee's
      // current shift.
      const result = updateEmployee(employee.id, { shiftId: newShiftId });
      if (!result.ok) return result;
      logEvent({
        employeeId: employee.employeeId,
        siteId: employee.siteId,
        eventType: "Shift Changed",
        previousValue: previousShift,
        newValue: shift.name,
        comment,
        date: effectiveDate,
      });
      mirror(`shift-${employee.employeeId}-${effectiveDate}`, employee.siteId, comment);
      return { ok: true, message: `${employee.name}'s shift changed to ${shift.name}, effective ${effectiveDate}.` };
    },
    [canManageLifecycle, getEmployeeById, masterRecords, updateEmployee, logEvent, mirror],
  );

  const value = useMemo<EmployeeLifecycleContextValue>(
    () => ({
      events,
      eventsForEmployee,
      canManageLifecycle,
      canTransferCrossSite,
      confirmEmployee,
      transferEmployee,
      promoteEmployee,
      changeManager,
      changeShift,
    }),
    [events, eventsForEmployee, canManageLifecycle, canTransferCrossSite, confirmEmployee, transferEmployee, promoteEmployee, changeManager, changeShift],
  );

  return <EmployeeLifecycleContext.Provider value={value}>{children}</EmployeeLifecycleContext.Provider>;
}

export function useEmployeeLifecycle() {
  const ctx = useContext(EmployeeLifecycleContext);
  if (!ctx) throw new Error("useEmployeeLifecycle must be used within an EmployeeLifecycleProvider");
  return ctx;
}
