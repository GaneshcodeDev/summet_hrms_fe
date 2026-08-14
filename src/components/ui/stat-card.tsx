import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "indigo" | "emerald" | "amber" | "rose" | "sky";
  trend?: string;
  trendDirection?: "up" | "down";
}

const tones = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  trend,
  trendDirection = "up",
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trendDirection === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}
