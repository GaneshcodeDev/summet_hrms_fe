"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Check,
  Download,
  FileText,
  Landmark,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { payrollCostByDept, payrollHistory, payrollSummary } from "@/lib/mock-data";
import { loanTenureGuide, loanTypes } from "@/lib/payroll-data";
import { usePayroll } from "@/lib/payroll-context";
import { useMasters } from "@/lib/master-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import type { EmployeeLoan, LoanType, TaxDeclaration, TaxRegime } from "@/lib/types";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "payslips", label: "Payslips" },
  { id: "components", label: "Components" },
  { id: "loans", label: "Loans" },
  { id: "tax", label: "Tax" },
  { id: "reports", label: "Reports" },
];

const currentFinancialYear = "2024-25";

export default function PayrollPage() {
  const [active, setActive] = useState("dashboard");
  const { resolvedTheme } = useTheme();
  const toast = useToast();
  const isDark = resolvedTheme === "dark";
  const tickColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    fontSize: 12,
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#0f172a",
  };

  function handleProcessPayroll() {
    toast.info("Payroll run queued for May 2024 — this is a demo environment, no real payout is processed.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Dashboard"
        description="Overview of payroll processing and cost distribution"
        action={
          <Can feature="payroll.payslips" action="manage">
            <Button onClick={handleProcessPayroll}>Process Payroll</Button>
          </Can>
        }
      />

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Employee" value="523" icon={Users} tone="indigo" />
            <StatCard label="Processed" value="512" icon={Banknote} tone="emerald" />
            <StatCard label="Pending" value="8" icon={FileText} tone="amber" />
            <StatCard label="Total Payroll Cost" value="₹1,25,80,000" icon={Landmark} tone="rose" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Payroll Summary</CardTitle>
                <span className="text-xs text-slate-400 dark:text-slate-500">Last 6 months (₹ Lakhs)</span>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payrollSummary} margin={{ left: 10, right: 20 }}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor }} width={30} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll Cost by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payrollCostByDept}
                        dataKey="value"
                        innerRadius={36}
                        outerRadius={56}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {payrollCostByDept.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {payrollCostByDept.map((d) => (
                    <li key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{d.value}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Payslips</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 pt-0 dark:divide-slate-800">
              {payrollHistory.map((p) => (
                <div key={p.month} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.month}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{p.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href="/payroll/payslip" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      View
                    </Link>
                    <button className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {active === "payslips" && (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {payrollHistory.map((p) => (
            <div key={p.month} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Payslip — {p.month}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{p.status}</p>
              </div>
              <Link href="/payroll/payslip">
                <Button size="sm" variant="secondary">
                  View Payslip
                </Button>
              </Link>
            </div>
          ))}
        </Card>
      )}

      {active === "components" && <ComponentsTab />}
      {active === "loans" && <LoansTab />}
      {active === "tax" && <TaxTab />}
      {active === "reports" && <ReportsTab />}
    </div>
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
      type: String(form.get("type")) as LoanType,
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
  const { isAllSites, currentSite } = useSite();
  const { visibleLoans } = usePayroll();
  const toast = useToast();
  const activeLoanExposure = visibleLoans()
    .filter((l) => l.status === "Active")
    .reduce((sum, l) => sum + l.outstandingAmount, 0);

  function handleExport() {
    const rows = [
      ["Department", "Cost Share (%)"],
      ...payrollCostByDept.map((d) => [d.name, String(d.value)]),
    ];
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
        <StatCard label="Total Payroll Cost" value="₹1,25,80,000" icon={Landmark} tone="indigo" trend="This month" />
        <StatCard
          label="Outstanding Loan Exposure"
          value={`₹${activeLoanExposure.toLocaleString("en-IN")}`}
          icon={Wallet}
          tone="amber"
        />
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
              <Th>Cost Share</Th>
            </THead>
            <TBody>
              {payrollCostByDept.map((d) => (
                <Tr key={d.name}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{d.name}</Td>
                  <Td>{d.value}%</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
