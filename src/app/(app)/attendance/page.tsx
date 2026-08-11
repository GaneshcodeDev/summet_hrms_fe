"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { attendanceMay2024, attendanceSummary } from "@/lib/mock-data";
import type { AttendanceStatus } from "@/lib/types";

const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  Absent: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  "Half Day": "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  "On Leave": "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  Holiday: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  Weekend: "bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// May 2024 starts on a Wednesday
const leadingBlanks = 3;

export default function AttendancePage() {
  const [view, setView] = useState<"calendar" | "list">("calendar");

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Track your daily attendance record" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <CardTitle>May 2024</CardTitle>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                onClick={() => setView("calendar")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  view === "calendar"
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Calendar
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  view === "list"
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {view === "calendar" ? (
              <div className="grid grid-cols-7 gap-2">
                {dayLabels.map((d) => (
                  <div key={d} className="pb-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                    {d}
                  </div>
                ))}
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {attendanceMay2024.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm font-medium",
                      statusStyles[day.status],
                    )}
                  >
                    {day.date}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendanceMay2024
                  .filter((d) => d.status !== "Weekend")
                  .map((day) => (
                    <div key={day.date} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">May {day.date}, 2024</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          statusStyles[day.status],
                        )}
                      >
                        {day.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              {Object.entries(statusStyles)
                .filter(([label]) => label !== "Weekend")
                .map(([label, cls]) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className={cn("h-2.5 w-2.5 rounded-full", cls.split(" ")[0])} />
                    {label}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-0">
            <SummaryTile label="Present Days" value={attendanceSummary.presentDays} tone="emerald" />
            <SummaryTile label="Absent Days" value={attendanceSummary.absentDays} tone="rose" />
            <SummaryTile label="Half Day" value={attendanceSummary.halfDays} tone="amber" />
            <SummaryTile label="On Leave" value={attendanceSummary.onLeave} tone="sky" />
            <div className="col-span-2 rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-500/10">
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{attendanceSummary.workingDays}</p>
              <p className="text-xs text-indigo-500 dark:text-indigo-400/80">Working Days</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber" | "sky";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  };
  return (
    <div className={cn("rounded-xl p-3 text-center", tones[tone])}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}
