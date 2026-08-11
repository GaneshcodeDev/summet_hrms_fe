"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Users, UserCheck, UserX, CalendarOff } from "lucide-react";
import { attendanceReport, departments, employees, TOTAL_EMPLOYEES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useSite, useSiteFilter } from "@/lib/site-context";

export default function ReportsPage() {
  const { currentSite, currentSiteId, isAllSites } = useSite();
  const [department, setDepartment] = useState("All Departments");

  const siteFiltered = useSiteFilter(attendanceReport);
  const filtered = siteFiltered.filter(
    (row) => department === "All Departments" || row.department === department,
  );

  const siteEmployeeCount = useMemo(
    () => (isAllSites ? TOTAL_EMPLOYEES : employees.filter((e) => e.siteId === currentSiteId).length),
    [isAllSites, currentSiteId],
  );
  const present = Math.round(siteEmployeeCount * 0.788);
  const absent = Math.round(siteEmployeeCount * 0.082);
  const onLeave = Math.round(siteEmployeeCount * 0.076);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={
          isAllSites
            ? "Attendance report across your organization"
            : `Attendance report for ${currentSite?.name}`
        }
        action={
          <Button variant="outline">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={siteEmployeeCount.toString()} icon={Users} tone="indigo" />
        <StatCard label="Present" value={present.toString()} icon={UserCheck} tone="emerald" trend="78.8%" />
        <StatCard label="Absent" value={absent.toString()} icon={UserX} tone="rose" trend="8.2%" trendDirection="down" />
        <StatCard label="On Leave" value={onLeave.toString()} icon={CalendarOff} tone="amber" trend="7.6%" trendDirection="down" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Attendance Report</span>
          <div className="ml-auto flex items-center gap-3">
            <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-auto">
              <option>All Departments</option>
              {departments.map((d) => (
                <option key={d.id}>{d.name}</option>
              ))}
            </Select>
            <input
              type="date"
              defaultValue="2024-05-01"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <span className="text-slate-400 dark:text-slate-500">–</span>
            <input
              type="date"
              defaultValue="2024-05-31"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Present Days</Th>
              <Th>Absent Days</Th>
              <Th>Half Days</Th>
              <Th>On Leave</Th>
              <Th>Attendance %</Th>
            </THead>
            <TBody>
              {filtered.map((row) => (
                <Tr key={row.employee}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{row.employee}</Td>
                  <Td>{row.department}</Td>
                  <Td>{row.presentDays}</Td>
                  <Td>{row.absentDays}</Td>
                  <Td>{row.halfDays}</Td>
                  <Td>{row.onLeave}</Td>
                  <Td>
                    <span
                      className={cn(
                        "font-semibold",
                        row.attendancePct >= 90
                          ? "text-emerald-600 dark:text-emerald-400"
                          : row.attendancePct >= 80
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {row.attendancePct}%
                    </span>
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <EmptyRow colSpan={7}>No attendance records at this site yet.</EmptyRow>
              )}
            </TBody>
          </Table>
          <TableFootnote>
            Showing 1 to {filtered.length} of {filtered.length} entries
          </TableFootnote>
        </CardContent>
      </Card>
    </div>
  );
}
