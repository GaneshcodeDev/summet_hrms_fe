import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const palette = [
  "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
];

function colorFor(name: string) {
  const sum = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[sum % palette.length];
}

interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
