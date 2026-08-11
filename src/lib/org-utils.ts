import type { ChartNode } from "@/components/organization/tree-chart";
import { orgUnitTypeConfig } from "@/lib/org-data";
import { getEmployeeById } from "@/lib/mock-data";
import type { Employee, OrgUnit } from "@/lib/types";

/** Builds a person-to-person reporting chart from employees' reportingManagerId — no static data. */
export function buildReportingTree(employees: Employee[], rootEmployeeId?: string): ChartNode | null {
  const byManager = new Map<string, Employee[]>();
  for (const e of employees) {
    if (e.reportingManagerId) {
      const list = byManager.get(e.reportingManagerId) ?? [];
      list.push(e);
      byManager.set(e.reportingManagerId, list);
    }
  }

  function countDescendants(employeeId: string): number {
    const direct = byManager.get(employeeId) ?? [];
    return direct.reduce((sum, child) => sum + 1 + countDescendants(child.employeeId), 0);
  }

  function toNode(employee: Employee): ChartNode {
    const children = (byManager.get(employee.employeeId) ?? []).map(toNode);
    const totalReports = countDescendants(employee.employeeId);
    return {
      id: employee.employeeId,
      label: employee.name,
      sublabel: employee.designation,
      badge: totalReports > 0 ? `+${totalReports} Member${totalReports === 1 ? "" : "s"}` : undefined,
      href: `/employees/${employee.employeeId}`,
      muted: employee.status === "Inactive",
      children: children.length ? children : undefined,
    };
  }

  const root = rootEmployeeId
    ? employees.find((e) => e.employeeId === rootEmployeeId)
    : employees.find((e) => !e.reportingManagerId);
  return root ? toNode(root) : null;
}

/** Builds a visual chart of the entity hierarchy (Company -> ... -> Sub Department, etc.) rooted at `rootId`. */
export function buildOrgUnitTree(units: OrgUnit[], rootId: string): ChartNode | null {
  const byParent = new Map<string, OrgUnit[]>();
  for (const u of units) {
    if (u.parentId) {
      const list = byParent.get(u.parentId) ?? [];
      list.push(u);
      byParent.set(u.parentId, list);
    }
  }

  function toNode(unit: OrgUnit): ChartNode {
    const children = (byParent.get(unit.id) ?? []).map(toNode);
    const head = unit.headEmployeeId ? getEmployeeById(unit.headEmployeeId) : undefined;
    const typeLabel = orgUnitTypeConfig[unit.type].label;
    return {
      id: unit.id,
      label: unit.name,
      sublabel: head ? `${typeLabel} · ${head.name}` : typeLabel,
      badge: children.length ? `${children.length} unit${children.length === 1 ? "" : "s"}` : undefined,
      muted: unit.status === "Inactive",
      children: children.length ? children : undefined,
    };
  }

  const root = units.find((u) => u.id === rootId);
  return root ? toNode(root) : null;
}
