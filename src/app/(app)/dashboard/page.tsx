"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Users,
  UserCheck,
  CalendarOff,
  Briefcase,
  UserPlus,
  CalendarPlus,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import {
  TOTAL_EMPLOYEES,
  attendanceOverview,
  currentUser,
  departmentDistribution,
  employees,
  jobOpenings,
  recentActivities,
  upcomingBirthdays,
} from "@/lib/mock-data";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useTheme } from "@/lib/theme-context";

const leaveSummary = [
  { label: "Casual Leave", used: 12, total: 15 },
  { label: "Sick Leave", used: 10, total: 12 },
  { label: "Earned Leave", used: 18, total: 20 },
  { label: "Comp Off", used: 4, total: 5 },
];

const quickActions = [
  { label: "Add Employee", icon: UserPlus, href: "/employees" },
  { label: "Apply Leave", icon: CalendarPlus, href: "/leave" },
  { label: "View Payslip", icon: FileText, href: "/payroll/payslip" },
];

export default function DashboardPage() {
  const { currentSite, isAllSites } = useSite();
  const [activitiesModalOpen, setActivitiesModalOpen] = useState(false);
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
  const siteEmployees = useSiteFilter(employees);
  const siteJobs = useSiteFilter(jobOpenings);
  const totalEmployees = isAllSites ? TOTAL_EMPLOYEES : siteEmployees.length;
  const presentToday = Math.round(totalEmployees * 0.788);
  const onLeaveToday = Math.round(totalEmployees * 0.082);
  const openPositions = isAllSites ? 28 : siteJobs.filter((j) => j.status === "Active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Welcome back, {currentUser.name}! 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isAllSites
            ? "Here's what's happening across all your sites today."
            : `Here's what's happening at ${currentSite?.name} today.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={totalEmployees.toString()} icon={Users} tone="indigo" trend="+12% last month" />
        <StatCard label="Present Today" value={presentToday.toString()} icon={UserCheck} tone="emerald" trend="78.8% of employees" />
        <StatCard label="On Leave" value={onLeaveToday.toString()} icon={CalendarOff} tone="amber" trend="8.2% of employees" trendDirection="down" />
        <StatCard label="Open Positions" value={openPositions.toString()} icon={Briefcase} tone="rose" trend={`${openPositions} active openings`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Overview</CardTitle>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">This Month</span>
            </CardHeader>
            <CardContent className="h-56 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceOverview} margin={{ left: 10, right: 20 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor }} width={30} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Department Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentDistribution}
                        dataKey="value"
                        innerRadius={32}
                        outerRadius={50}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {departmentDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {departmentDistribution.map((d) => (
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

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Birthdays</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {upcomingBirthdays.map((b) => (
                  <div key={b.name} className="flex items-center gap-3">
                    <Avatar name={b.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{b.name}</p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{b.date}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {leaveSummary.map((l) => (
                  <div key={l.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{l.label}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {l.used}/{l.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500"
                        style={{ width: `${(l.used / l.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 pt-0">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-1 min-w-[140px] flex-col items-center gap-2 rounded-xl border border-slate-100 py-5 text-center hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{action.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-5 pt-0">
            {recentActivities.slice(0, 4).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <Avatar name={activity.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-medium">{activity.name}</span>{" "}
                    {activity.action}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{activity.time}</p>
                </div>
              </div>
            ))}
            <button
              onClick={() => setActivitiesModalOpen(true)}
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View All <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={activitiesModalOpen}
        onClose={() => setActivitiesModalOpen(false)}
        title="All Recent Activities"
      >
        <div className="max-h-[60vh] space-y-5 overflow-y-auto">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <Avatar name={activity.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-medium">{activity.name}</span> {activity.action}
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
