"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, Download, FileText, Landmark, Users } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { payrollCostByDept, payrollHistory, payrollSummary } from "@/lib/mock-data";
import { useTheme } from "@/lib/theme-context";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "payslips", label: "Payslips" },
  { id: "components", label: "Components" },
  { id: "loans", label: "Loans" },
  { id: "tax", label: "Tax" },
  { id: "reports", label: "Reports" },
];

export default function PayrollPage() {
  const [active, setActive] = useState("dashboard");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const tickColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    fontSize: 12,
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#0f172a",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Dashboard"
        description="Overview of payroll processing and cost distribution"
        action={<Button>Process Payroll</Button>}
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

      {["components", "loans", "tax", "reports"].includes(active) && (
        <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
          {tabs.find((t) => t.id === active)?.label} module coming soon.
        </Card>
      )}
    </div>
  );
}
