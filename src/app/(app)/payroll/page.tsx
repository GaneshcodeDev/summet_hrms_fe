"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Lock,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { loanTenureGuide, loanTypes } from "@/lib/payroll-data";
import { usePayroll, type PayrollPreviewRow } from "@/lib/payroll-context";
import { useMasters } from "@/lib/master-context";
import { useEmployees } from "@/lib/employee-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import type { EmployeeLoan, SalaryLine, TaxDeclaration, TaxRegime } from "@/lib/types";

const currentFinancialYear = "2024-25";

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PayrollPage() {
  const [active, setActive] = useState("dashboard");
  const { canManageSalary, canProcessPayroll } = usePayroll();

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    ...(canManageSalary ? [{ id: "salary", label: "Salary Structure" }] : []),
    ...(canProcessPayroll ? [{ id: "run", label: "Payroll Run" }] : []),
    { id: "payslips", label: "Payslips" },
    { id: "components", label: "Components" },
    { id: "loans", label: "Loans" },
    { id: "tax", label: "Tax" },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Salary structure, payroll processing and payslips" />
      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "dashboard" && <DashboardTab />}
      {active === "salary" && canManageSalary && <SalaryStructureTab />}
      {active === "run" && canProcessPayroll && <PayrollRunTab />}
      {active === "payslips" && <PayslipsTab />}
      {active === "components" && <ComponentsTab />}
      {active === "loans" && <LoansTab />}
      {active === "tax" && <TaxTab />}
      {active === "reports" && <ReportsTab />}
    </div>
  );
}

function DashboardTab() {
  const { currentSite, currentSiteId, isAllSites } = useSite();
  const { employees } = useEmployees();
  const { runsForSite, payslipsForRun, salaryStructures } = usePayroll();

  if (isAllSites || !currentSiteId) {
    return (
      <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Select a site from the switcher above to view its payroll.
      </Card>
    );
  }

  const siteEmployees = employees.filter((e) => e.siteId === currentSiteId);
  const runs = runsForSite(currentSiteId).slice().sort((a, b) => (a.month < b.month ? 1 : -1));
  const latestRun = runs[0];
  const configuredCount = salaryStructures.filter((s) => s.siteId === currentSiteId).length;

  if (siteEmployees.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Employees" value="0" icon={Users} tone="indigo" />
          <StatCard label="Salary Configured" value="0" icon={Banknote} tone="emerald" />
          <StatCard label="Pending" value="0" icon={FileText} tone="amber" />
          <StatCard label="Total Payroll Cost" value="Not Processed" icon={Landmark} tone="rose" />
        </div>
        <Card className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No employees at {currentSite?.name} yet — add employees before running payroll.
        </Card>
      </div>
    );
  }

  if (!latestRun) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Employees" value={String(siteEmployees.length)} icon={Users} tone="indigo" />
          <StatCard label="Salary Configured" value={String(configuredCount)} icon={Banknote} tone="emerald" />
          <StatCard label="Pending" value={String(siteEmployees.length)} icon={FileText} tone="amber" />
          <StatCard label="Total Payroll Cost" value="Not Processed" icon={Landmark} tone="rose" />
        </div>
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Payroll has not been processed yet.</p>
          <Link href="/payroll?tab=run">
            <Button size="sm">Go to Payroll Run</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const latestPayslips = payslipsForRun(latestRun.id);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={String(siteEmployees.length)} icon={Users} tone="indigo" />
        <StatCard label="Processed" value={String(latestRun.employeeCount)} icon={Banknote} tone="emerald" />
        <StatCard label="Pending" value={String(Math.max(0, siteEmployees.length - latestRun.employeeCount))} icon={FileText} tone="amber" />
        <StatCard label="Total Payroll Cost" value={inr(latestRun.totalNet)} icon={Landmark} tone="rose" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Run — {formatMonth(latestRun.month)}</CardTitle>
          <StatusBadge status={latestRun.status} />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Gross</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{inr(latestRun.totalGross)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Deductions</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{inr(latestRun.totalDeductions)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Net</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{inr(latestRun.totalNet)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Payslips</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{latestPayslips.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 pt-0 dark:divide-slate-800">
          {runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatMonth(r.month)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {r.employeeCount} payslip(s) &middot; {inr(r.totalNet)}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SalaryStructureTab() {
  const { currentSite, currentSiteId, isAllSites } = useSite();
  const { employees } = useEmployees();
  const { salaryStructureFor, defaultSalaryLinesFor, saveSalaryStructure } = usePayroll();
  const toast = useToast();
  const [editTarget, setEditTarget] = useState<{ employeeId: string; name: string } | null>(null);
  const [ctcDraft, setCtcDraft] = useState(0);
  const [earningsDraft, setEarningsDraft] = useState<SalaryLine[]>([]);
  const [deductionsDraft, setDeductionsDraft] = useState<SalaryLine[]>([]);

  if (isAllSites || !currentSiteId) {
    return (
      <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Select a site from the switcher above to manage salary structures.
      </Card>
    );
  }

  const siteEmployees = employees.filter((e) => e.siteId === currentSiteId);

  function openEditor(employeeId: string, name: string) {
    const existing = salaryStructureFor(employeeId);
    const ctc = existing?.ctcAnnual ?? 0;
    setCtcDraft(ctc);
    if (existing) {
      setEarningsDraft(existing.earnings);
      setDeductionsDraft(existing.deductions);
    } else {
      setEarningsDraft([]);
      setDeductionsDraft([]);
    }
    setEditTarget({ employeeId, name });
  }

  function regenerateFromCtc(ctc: number) {
    if (!currentSiteId || ctc <= 0) return;
    const { earnings, deductions } = defaultSalaryLinesFor(currentSiteId, ctc);
    setEarningsDraft(earnings);
    setDeductionsDraft(deductions);
  }

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget || !currentSiteId) return;
    const result = saveSalaryStructure({
      employeeId: editTarget.employeeId,
      siteId: currentSiteId,
      ctcAnnual: ctcDraft,
      earnings: earningsDraft,
      deductions: deductionsDraft,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEditTarget(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">Salary structures at {currentSite?.name}</p>
      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Designation</Th>
            <Th>Annual CTC</Th>
            <Th>Monthly Gross</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {siteEmployees.map((e) => {
              const structure = salaryStructureFor(e.employeeId);
              return (
                <Tr key={e.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{e.designation}</Td>
                  <Td>{structure ? inr(structure.ctcAnnual) : <span className="text-xs text-slate-400 dark:text-slate-500">Not configured</span>}</Td>
                  <Td>{structure ? inr(structure.grossMonthly) : "—"}</Td>
                  <Td>
                    <button
                      onClick={() => openEditor(e.employeeId, e.name)}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {structure ? "Edit" : "Assign"}
                    </button>
                  </Td>
                </Tr>
              );
            })}
            {siteEmployees.length === 0 && <EmptyRow colSpan={5}>No employees at this site yet.</EmptyRow>}
          </TBody>
        </Table>
      </Card>

      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title={`Salary Structure — ${editTarget?.name ?? ""}`}>
        <form className="space-y-4" onSubmit={handleSave}>
          <Field label="Annual CTC (₹)">
            <Input
              type="number"
              min={0}
              step={1000}
              value={ctcDraft || ""}
              onChange={(e) => setCtcDraft(Number(e.target.value))}
              onBlur={() => regenerateFromCtc(ctcDraft)}
              placeholder="e.g. 600000"
            />
          </Field>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Tab out of the CTC field to auto-split it into components below (using this site&apos;s configured rates in
            Masters, or sensible defaults). Every line is editable before saving.
          </p>

          {earningsDraft.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Earnings (monthly)</p>
                <div className="space-y-2">
                  {earningsDraft.map((line, i) => (
                    <div key={line.componentId} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">{line.label}</span>
                      <Input
                        type="number"
                        min={0}
                        value={line.amount}
                        onChange={(e) =>
                          setEarningsDraft((prev) => prev.map((l, idx) => (idx === i ? { ...l, amount: Number(e.target.value) } : l)))
                        }
                        className="w-28"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Deductions (monthly)</p>
                <div className="space-y-2">
                  {deductionsDraft.map((line, i) => (
                    <div key={line.componentId} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">{line.label}</span>
                      <Input
                        type="number"
                        min={0}
                        value={line.amount}
                        onChange={(e) =>
                          setDeductionsDraft((prev) => prev.map((l, idx) => (idx === i ? { ...l, amount: Number(e.target.value) } : l)))
                        }
                        className="w-28"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={earningsDraft.length === 0}>
              Save Salary Structure
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PayrollRunTab() {
  const { currentSite, currentSiteId, isAllSites } = useSite();
  const { runForMonth, previewPayrollRun, processPayrollRun, approvePayrollRun, lockPayrollRun, payslipsForRun } = usePayroll();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonthStr());
  const [preview, setPreview] = useState<PayrollPreviewRow[] | null>(null);

  if (isAllSites || !currentSiteId) {
    return (
      <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Select a site from the switcher above to run its payroll.
      </Card>
    );
  }

  const existingRun = runForMonth(currentSiteId, month);

  function handlePreview() {
    setPreview(previewPayrollRun(currentSiteId!, month));
  }

  function handleProcess() {
    const result = processPayrollRun(currentSiteId!, month);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setPreview(null);
  }

  function handleApprove(id: string) {
    const result = approvePayrollRun(id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleLock(id: string) {
    const result = lockPayrollRun(id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  const runPayslips = existingRun ? payslipsForRun(existingRun.id) : [];
  const eligibleCount = preview?.filter((r) => r.hasSalaryStructure).length ?? 0;
  const skippedCount = preview?.filter((r) => !r.hasSalaryStructure).length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Process Payroll — {currentSite?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Month">
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPreview(null); }} className="w-auto" />
            </Field>
            {!existingRun && (
              <Button variant="outline" onClick={handlePreview}>
                Preview
              </Button>
            )}
            {!existingRun && preview && (
              <Button onClick={handleProcess} disabled={eligibleCount === 0}>
                Process Payroll ({eligibleCount})
              </Button>
            )}
          </div>

          {existingRun && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-4 dark:border-slate-800">
              <StatusBadge status={existingRun.status} />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {existingRun.employeeCount} payslip(s) &middot; {inr(existingRun.totalNet)} net
              </span>
              <div className="ml-auto flex gap-2">
                {existingRun.status === "Processing" && (
                  <Button size="sm" onClick={() => handleApprove(existingRun.id)}>
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                )}
                {existingRun.status === "Approved" && (
                  <Button size="sm" onClick={() => handleLock(existingRun.id)}>
                    <Lock className="h-4 w-4" /> Lock
                  </Button>
                )}
                {existingRun.status === "Locked" && (
                  <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    <Lock className="h-3.5 w-3.5" /> Locked — no further changes.
                  </span>
                )}
              </div>
            </div>
          )}

          {preview && !existingRun && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {eligibleCount} employee(s) ready &middot; {skippedCount} skipped (no salary structure configured)
              </p>
              <Table>
                <THead>
                  <Th>Employee</Th>
                  <Th>Working Days</Th>
                  <Th>LOP Days</Th>
                  <Th>Overtime (hrs)</Th>
                  <Th>Gross</Th>
                  <Th>Deductions</Th>
                  <Th>Net Pay</Th>
                </THead>
                <TBody>
                  {preview.map((row) => (
                    <Tr key={row.employeeId}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{row.employeeName}</Td>
                      {row.hasSalaryStructure && row.result ? (
                        <>
                          <Td>{row.result.workingDays}</Td>
                          <Td>{row.result.lopDays}</Td>
                          <Td>{row.result.overtimeHours}</Td>
                          <Td>{inr(row.result.grossEarnings)}</Td>
                          <Td>{inr(row.result.totalDeductions)}</Td>
                          <Td className="font-semibold">{inr(row.result.netPay)}</Td>
                        </>
                      ) : (
                        <Td colSpan={6} className="text-xs text-slate-400 dark:text-slate-500">
                          No salary structure configured — skipped
                        </Td>
                      )}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}

          {existingRun && runPayslips.length > 0 && (
            <Table>
              <THead>
                <Th>Employee</Th>
                <Th>Working Days</Th>
                <Th>LOP Days</Th>
                <Th>Overtime (hrs)</Th>
                <Th>Gross</Th>
                <Th>Deductions</Th>
                <Th>Net Pay</Th>
              </THead>
              <TBody>
                {runPayslips.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{p.employeeId}</Td>
                    <Td>{p.workingDays}</Td>
                    <Td>{p.lopDays}</Td>
                    <Td>{p.overtimeHours}</Td>
                    <Td>{inr(p.grossEarnings)}</Td>
                    <Td>{inr(p.totalDeductions)}</Td>
                    <Td className="font-semibold">{inr(p.netPay)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayslipsTab() {
  const { currentUser, canFeature } = useAccessControl();
  const { isAllSites } = useSite();
  const { payslips, payslipsForEmployee, runForMonth } = usePayroll();
  const { employees } = useEmployees();

  const canViewAll = canFeature("payroll.payslips", "manage") || canFeature("payroll.payslips", "export");
  const siteFilteredPayslips = useSiteFilter(payslips);

  if (canViewAll) {
    const sitePayslips = siteFilteredPayslips.filter((p) => {
      const run = runForMonth(p.siteId, p.month);
      return run && run.status !== "Processing";
    });
    return (
      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Month</Th>
            <Th>Gross</Th>
            <Th>Deductions</Th>
            <Th>Net Pay</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {sitePayslips.map((p) => {
              const emp = employees.find((e) => e.employeeId === p.employeeId);
              return (
                <Tr key={p.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{emp?.name ?? p.employeeId}</Td>
                  <Td>{formatMonth(p.month)}</Td>
                  <Td>{inr(p.grossEarnings)}</Td>
                  <Td>{inr(p.totalDeductions)}</Td>
                  <Td className="font-semibold">{inr(p.netPay)}</Td>
                  <Td>
                    <Link href={`/payroll/payslip?id=${p.id}`} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      View
                    </Link>
                  </Td>
                </Tr>
              );
            })}
            {sitePayslips.length === 0 && <EmptyRow colSpan={6}>No payslips generated yet for {isAllSites ? "any site" : "this site"}.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
    );
  }

  const myPayslips = payslipsForEmployee(currentUser.employeeId).filter((p) => {
    const run = runForMonth(p.siteId, p.month);
    return run && run.status !== "Processing";
  });

  return (
    <Card className="divide-y divide-slate-100 dark:divide-slate-800">
      {myPayslips.map((p) => (
        <div key={p.id} className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Payslip — {formatMonth(p.month)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Net Pay: {inr(p.netPay)}</p>
          </div>
          <Link href={`/payroll/payslip?id=${p.id}`}>
            <Button size="sm" variant="secondary">
              View Payslip
            </Button>
          </Link>
        </div>
      ))}
      {myPayslips.length === 0 && (
        <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Payroll has not been processed yet.
        </div>
      )}
    </Card>
  );
}

function ComponentsTab() {
  const { recordsOfType } = useMasters();
  const components = recordsOfType("SalaryComponent");
  const earnings = components.filter((c) => c.attributes.componentType === "Earning");
  const deductions = components.filter((c) => c.attributes.componentType === "Deduction");

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Salary Components</CardTitle>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Earning and deduction line items used to build every employee&apos;s salary structure. Full CRUD, codes
            and calculation rules live in{" "}
            <Link href="/masters/salary-component" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Masters
            </Link>
            .
          </p>
        </div>
        <Link href="/masters/salary-component">
          <Button variant="outline" size="sm">
            Manage in Masters <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 pt-0 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Earnings ({earnings.length})
          </p>
          <div className="space-y-2">
            {earnings.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 text-sm dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{c.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{String(c.attributes.calculationType ?? "—")}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
            {earnings.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No earning components configured.</p>}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Deductions ({deductions.length})
          </p>
          <div className="space-y-2">
            {deductions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 text-sm dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{c.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{String(c.attributes.calculationType ?? "—")}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
            {deductions.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No deduction components configured.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoansTab() {
  const { currentSite, isAllSites } = useSite();
  const toast = useToast();
  const { visibleLoans, canDecideLoans, applyLoan, decideLoan } = usePayroll();
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<EmployeeLoan | null>(null);
  const filtered = useSiteFilter(visibleLoans());

  function handleApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = applyLoan({
      type: String(form.get("type")) as EmployeeLoan["type"],
      principalAmount: Number(form.get("principalAmount")),
      tenureMonths: Number(form.get("tenureMonths")),
      reason: String(form.get("reason") ?? ""),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleApprove(loan: EmployeeLoan) {
    const result = decideLoan(loan.id, "Approved");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = decideLoan(rejectTarget.id, "Rejected", String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isAllSites ? "Employee loans and salary advances across all sites" : `Employee loans at ${currentSite?.name}`}
        </p>
        <Can feature="payroll.loans" action="create">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Apply for Loan
          </Button>
        </Can>
      </div>

      <Card>
        <Table>
          <THead>
            {canDecideLoans && <Th>Employee</Th>}
            <Th>Type</Th>
            <Th>Principal</Th>
            <Th>EMI</Th>
            <Th>Outstanding</Th>
            <Th>Status</Th>
            {canDecideLoans && <Th>Actions</Th>}
          </THead>
          <TBody>
            {filtered.map((loan) => (
              <Tr key={loan.id}>
                {canDecideLoans && <Td className="font-medium text-slate-800 dark:text-slate-100">{loan.employee}</Td>}
                <Td>{loan.type}</Td>
                <Td>₹{loan.principalAmount.toLocaleString("en-IN")}</Td>
                <Td>₹{loan.emiAmount.toLocaleString("en-IN")}/mo</Td>
                <Td>₹{loan.outstandingAmount.toLocaleString("en-IN")}</Td>
                <Td>
                  <StatusBadge status={loan.status} />
                  {loan.status === "Rejected" && loan.decisionReason && (
                    <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">{loan.decisionReason}</p>
                  )}
                </Td>
                {canDecideLoans && (
                  <Td>
                    {loan.status === "Pending" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(loan)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectTarget(loan)}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">
                        {loan.approverName ? `by ${loan.approverName}` : "—"}
                      </span>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={canDecideLoans ? 7 : 5}>
                {canDecideLoans ? "No loan requests at this site yet." : "You haven't applied for any loans yet."}
              </EmptyRow>
            )}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply for Loan">
        <form className="space-y-4" onSubmit={handleApply}>
          <Field label="Loan Type">
            <Select name="type" required defaultValue={loanTypes[0]}>
              {loanTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₹)">
              <Input name="principalAmount" type="number" min={1000} step={1000} required placeholder="e.g. 50000" />
            </Field>
            <Field label="Tenure (months)">
              <Input name="tenureMonths" type="number" min={1} max={120} required placeholder="e.g. 12" />
            </Field>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Typical tenure for {loanTypes.map((t) => `${t} (up to ${loanTenureGuide[t]} mo)`).join(", ")}.
          </p>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="Briefly describe what this loan is for" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Loan Request">
        {rejectTarget && (
          <form className="space-y-4" onSubmit={handleRejectSubmit}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rejecting <span className="font-medium text-slate-700 dark:text-slate-200">{rejectTarget.employee}</span>
              &apos;s {rejectTarget.type} request for ₹{rejectTarget.principalAmount.toLocaleString("en-IN")}.
            </p>
            <Field label="Reason for Rejection">
              <Textarea name="reason" rows={3} required placeholder="e.g. Existing loan not yet cleared" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Reject Request
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

const taxRegimes: TaxRegime[] = ["Old Regime", "New Regime"];

function TaxTab() {
  const { currentUser } = useAccessControl();
  const { currentSite, isAllSites } = useSite();
  const toast = useToast();
  const { visibleTaxDeclarations, canVerifyTax, submitTaxDeclaration, decideTaxDeclaration } = usePayroll();
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<TaxDeclaration | null>(null);
  const filtered = useSiteFilter(visibleTaxDeclarations());

  const myDeclaration = filtered.find(
    (t) => t.employeeId === currentUser.employeeId && t.financialYear === currentFinancialYear,
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = submitTaxDeclaration({
      financialYear: currentFinancialYear,
      regime: String(form.get("regime")) as TaxRegime,
      section80C: Number(form.get("section80C") || 0),
      section80D: Number(form.get("section80D") || 0),
      hraExemptionClaimed: Number(form.get("hraExemptionClaimed") || 0),
      otherExemptions: Number(form.get("otherExemptions") || 0),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setModalOpen(false);
  }

  function handleVerify(declaration: TaxDeclaration) {
    const result = decideTaxDeclaration(declaration.id, "Verified");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = decideTaxDeclaration(rejectTarget.id, "Rejected", String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isAllSites ? "Investment declarations across all sites" : `Investment declarations at ${currentSite?.name}`}{" "}
          &middot; FY {currentFinancialYear}
        </p>
        <Can feature="payroll.tax" action="create">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <ShieldCheck className="h-4 w-4" /> {myDeclaration ? "Update Declaration" : "Submit Declaration"}
          </Button>
        </Can>
      </div>

      <Card>
        <Table>
          <THead>
            {canVerifyTax && <Th>Employee</Th>}
            <Th>Regime</Th>
            <Th>80C</Th>
            <Th>80D</Th>
            <Th>HRA Exemption</Th>
            <Th>Status</Th>
            {canVerifyTax && <Th>Actions</Th>}
          </THead>
          <TBody>
            {filtered.map((t) => (
              <Tr key={t.id}>
                {canVerifyTax && <Td className="font-medium text-slate-800 dark:text-slate-100">{t.employee}</Td>}
                <Td>{t.regime}</Td>
                <Td>₹{t.section80C.toLocaleString("en-IN")}</Td>
                <Td>₹{t.section80D.toLocaleString("en-IN")}</Td>
                <Td>₹{t.hraExemptionClaimed.toLocaleString("en-IN")}</Td>
                <Td>
                  <StatusBadge status={t.status} />
                  {t.status === "Rejected" && t.decisionReason && (
                    <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">{t.decisionReason}</p>
                  )}
                </Td>
                {canVerifyTax && (
                  <Td>
                    {t.status === "Submitted" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerify(t)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                        >
                          <Check className="h-3.5 w-3.5" /> Verify
                        </button>
                        <button
                          onClick={() => setRejectTarget(t)}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">
                        {t.verifiedBy ? `by ${t.verifiedBy}` : "—"}
                      </span>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={canVerifyTax ? 7 : 5}>No tax declarations submitted yet.</EmptyRow>
            )}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Tax Declaration — FY ${currentFinancialYear}`}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Tax Regime">
            <Select name="regime" required defaultValue={myDeclaration?.regime ?? taxRegimes[0]}>
              {taxRegimes.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Section 80C (₹)">
              <Input name="section80C" type="number" min={0} step={1000} defaultValue={myDeclaration?.section80C ?? 0} />
            </Field>
            <Field label="Section 80D (₹)">
              <Input name="section80D" type="number" min={0} step={1000} defaultValue={myDeclaration?.section80D ?? 0} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="HRA Exemption Claimed (₹)">
              <Input name="hraExemptionClaimed" type="number" min={0} step={1000} defaultValue={myDeclaration?.hraExemptionClaimed ?? 0} />
            </Field>
            <Field label="Other Exemptions (₹)">
              <Input name="otherExemptions" type="number" min={0} step={1000} defaultValue={myDeclaration?.otherExemptions ?? 0} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit for Verification</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Tax Declaration">
        {rejectTarget && (
          <form className="space-y-4" onSubmit={handleRejectSubmit}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rejecting <span className="font-medium text-slate-700 dark:text-slate-200">{rejectTarget.employee}</span>
              &apos;s FY {rejectTarget.financialYear} declaration.
            </p>
            <Field label="Reason for Rejection">
              <Textarea name="reason" rows={3} required placeholder="e.g. Proof of investment not attached" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Reject Declaration
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function ReportsTab() {
  const { isAllSites, currentSite, currentSiteId } = useSite();
  const { visibleLoans, runsForSite, payslipsForRun } = usePayroll();
  const { employees } = useEmployees();
  const toast = useToast();
  const activeLoanExposure = visibleLoans()
    .filter((l) => l.status === "Active")
    .reduce((sum, l) => sum + l.outstandingAmount, 0);

  const latestRun = currentSiteId ? runsForSite(currentSiteId).slice().sort((a, b) => (a.month < b.month ? 1 : -1))[0] : undefined;
  const latestPayslips = latestRun ? payslipsForRun(latestRun.id) : [];

  const costByDept = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of latestPayslips) {
      const emp = employees.find((e) => e.employeeId === p.employeeId);
      const dept = emp?.department || "Unassigned";
      totals.set(dept, (totals.get(dept) ?? 0) + p.netPay);
    }
    const grandTotal = Array.from(totals.values()).reduce((s, v) => s + v, 0);
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total, pct: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [latestPayslips, employees]);

  function handleExport() {
    const rows = [["Department", "Net Payroll Cost"], ...costByDept.map((d) => [d.name, String(d.total)])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payroll-cost-by-department.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Payroll cost report exported as CSV.");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Payroll Cost" value={latestRun ? inr(latestRun.totalNet) : "Not Processed"} icon={Landmark} tone="indigo" trend={latestRun ? formatMonth(latestRun.month) : undefined} />
        <StatCard label="Outstanding Loan Exposure" value={inr(activeLoanExposure)} icon={Wallet} tone="amber" />
        <StatCard label="Scope" value={isAllSites ? "All Sites" : currentSite?.name ?? "—"} icon={Users} tone="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Cost by Department</CardTitle>
          <Can feature="reports.analytics" action="export">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </Can>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          <Table>
            <THead>
              <Th>Department</Th>
              <Th>Net Cost</Th>
              <Th>Share</Th>
            </THead>
            <TBody>
              {costByDept.map((d) => (
                <Tr key={d.name}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{d.name}</Td>
                  <Td>{inr(d.total)}</Td>
                  <Td>{d.pct}%</Td>
                </Tr>
              ))}
              {costByDept.length === 0 && <EmptyRow colSpan={3}>No processed payroll to report on yet.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
