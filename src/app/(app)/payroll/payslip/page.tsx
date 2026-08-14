"use client";

import { Suspense } from "react";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { numberToWordsIndian } from "@/lib/number-to-words";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { usePayroll } from "@/lib/payroll-context";

function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function PayslipContent() {
  const searchParams = useSearchParams();
  const { currentUser, canFeature } = useAccessControl();
  const { getEmployeeByEmployeeId, bankDetailFor } = useEmployees();
  const { payslips, latestPayslipFor } = usePayroll();

  const canViewAll = canFeature("payroll.payslips", "manage") || canFeature("payroll.payslips", "export");
  const requestedId = searchParams.get("id");
  const payslip = requestedId ? payslips.find((p) => p.id === requestedId) : latestPayslipFor(currentUser.employeeId);

  const authorized = payslip && (payslip.employeeId === currentUser.employeeId || canViewAll);

  if (!payslip || !authorized) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/payroll" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
          {requestedId && !authorized
            ? "You're not authorized to view this payslip."
            : "Payroll has not been processed yet."}
        </Card>
      </div>
    );
  }

  const employee = getEmployeeByEmployeeId(payslip.employeeId);
  const bank = bankDetailFor(payslip.employeeId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/payroll"
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <Button>
          <Download className="h-4 w-4" /> Download Payslip
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Payslip</p>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{formatMonth(payslip.month)}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={employee?.name ?? payslip.employeeId} size="md" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{employee?.name ?? payslip.employeeId}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {payslip.employeeId} &middot; {employee?.designation ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 p-6 text-sm sm:grid-cols-4 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Generated On</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{new Date(payslip.generatedOn).toLocaleDateString("en-IN")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Paid Days</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {payslip.paidDays} / {payslip.workingDays}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Bank Name</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{bank?.bankName ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Bank Account</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{bank?.accountNumber ?? "—"}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-center text-white">
          <p className="text-xs uppercase tracking-wide text-indigo-100">Net Salary</p>
          <p className="mt-1 text-3xl font-bold">₹{payslip.netPay.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-indigo-100">{numberToWordsIndian(payslip.netPay)}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 p-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Earnings</h3>
            <div className="space-y-2.5">
              {payslip.earnings.map((e) => (
                <div key={e.componentId} className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{e.label}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">₹{e.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200">Total Earnings</span>
              <span className="text-slate-900 dark:text-white">₹{payslip.grossEarnings.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Deductions</h3>
            <div className="space-y-2.5">
              {payslip.deductions.map((d) => (
                <div key={d.componentId} className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{d.label}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">₹{d.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200">Total Deductions</span>
              <span className="text-slate-900 dark:text-white">₹{payslip.totalDeductions.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Net Salary</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">₹{payslip.netPay.toLocaleString("en-IN")}</span>
        </div>
      </Card>
    </div>
  );
}

export default function PayslipPage() {
  return (
    <Suspense fallback={null}>
      <PayslipContent />
    </Suspense>
  );
}
