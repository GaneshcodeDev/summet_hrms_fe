"use client";

import { useState } from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

const options: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Laptop },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Toggle theme"
      >
        <CurrentIcon className="h-4.5 w-4.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setTheme(option.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800",
                  theme === option.id
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-300",
                )}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
                {theme === option.id && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
