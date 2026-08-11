"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/form";
import { TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { employees } from "@/lib/mock-data";
import { useOrg } from "@/lib/org-context";
import { useSiteProfile } from "@/lib/site-profile-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useToast } from "@/lib/toast-context";

export default function EmployeeSiteMappingPage() {
  const { isAllSites, currentSite } = useSite();
  const { orgUnits } = useOrg();
  const { employeeSiteMappings, setEmployeeMapping } = useSiteProfile();
  const { canFeature } = useAccessControl();
  const toast = useToast();
  const [search, setSearch] = useState("");

  const canEdit = canFeature("organization.site-mapping", "edit") || canFeature("organization.site-mapping", "manage");

  const costCenters = orgUnits.filter((u) => u.type === "CostCenter" && u.status === "Active");
  const profitCenters = orgUnits.filter((u) => u.type === "ProfitCenter" && u.status === "Active");

  const scopedEmployees = useSiteFilter(employees);
  const filtered = useMemo(
    () =>
      scopedEmployees.filter(
        (e) =>
          !search.trim() ||
          e.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          e.employeeId.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [scopedEmployees, search],
  );

  function mappingFor(employeeId: string) {
    const override = employeeSiteMappings.find((m) => m.employeeId === employeeId);
    const base = employees.find((e) => e.employeeId === employeeId);
    return {
      costCenterId: override?.costCenterId ?? base?.costCenterId ?? "",
      profitCenterId: override?.profitCenterId ?? base?.profitCenterId ?? "",
    };
  }

  function handleChange(employeeId: string, field: "costCenterId" | "profitCenterId", value: string) {
    setEmployeeMapping(employeeId, field, value || null);
    toast.success("Mapping updated.");
  }

  return (
    <div>
      <PageHeader
        title="Employee Site Mapping"
        description={
          isAllSites
            ? "Map every employee to their Cost Center and Profit Center"
            : `Employee site mapping at ${currentSite?.name}`
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full max-w-sm rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Site</Th>
            <Th>Cost Center</Th>
            <Th>Profit Center</Th>
          </THead>
          <TBody>
            {filtered.map((e) => {
              const mapping = mappingFor(e.employeeId);
              return (
                <Tr key={e.employeeId}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} size="sm" />
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{e.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{e.employeeId} · {e.designation}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{e.location}</Td>
                  <Td>
                    <Select
                      value={mapping.costCenterId}
                      disabled={!canEdit}
                      onChange={(ev) => handleChange(e.employeeId, "costCenterId", ev.target.value)}
                      className="w-auto min-w-[180px]"
                    >
                      <option value="">Unmapped</option>
                      {costCenters.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.name}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Select
                      value={mapping.profitCenterId}
                      disabled={!canEdit}
                      onChange={(ev) => handleChange(e.employeeId, "profitCenterId", ev.target.value)}
                      className="w-auto min-w-[180px]"
                    >
                      <option value="">Unmapped</option>
                      {profitCenters.map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.name}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>
    </div>
  );
}
