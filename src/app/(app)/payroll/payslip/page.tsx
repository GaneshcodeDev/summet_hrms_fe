"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payslip } from "@/lib/mock-data";
import { numberToWordsIndian } from "@/lib/number-to-words";

export default function PayslipPage() {
  const totalEarnings = payslip.earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalDeductions = payslip.deductions.reduce((sum, d) => sum + d.amount, 0);
  const netSalary = totalEarnings - totalDeductions;

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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{payslip.month}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={payslip.employee} size="md" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{payslip.employee}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {payslip.employeeId} &middot; {payslip.designation}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 p-6 text-sm sm:grid-cols-4 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Payment Date</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{payslip.paymentDate}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Bank Name</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{payslip.bankName}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">Bank Account</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{payslip.bankAccount}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-center text-white">
          <p className="text-xs uppercase tracking-wide text-indigo-100">Net Salary</p>
          <p className="mt-1 text-3xl font-bold">₹{netSalary.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-indigo-100">{numberToWordsIndian(netSalary)}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 p-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Earnings</h3>
            <div className="space-y-2.5">
              {payslip.earnings.map((e) => (
                <div key={e.label} className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{e.label}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">₹{e.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200">Total Earnings</span>
              <span className="text-slate-900 dark:text-white">₹{totalEarnings.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Deductions</h3>
            <div className="space-y-2.5">
              {payslip.deductions.map((d) => (
                <div key={d.label} className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{d.label}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">₹{d.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200">Total Deductions</span>
              <span className="text-slate-900 dark:text-white">₹{totalDeductions.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Net Salary</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">₹{netSalary.toLocaleString("en-IN")}</span>
        </div>
      </Card>
    </div>
  );
}
