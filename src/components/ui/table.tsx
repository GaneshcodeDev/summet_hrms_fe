import { cn } from "@/lib/utils";
import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-100 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-5 py-3 font-medium", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
}

export function Tr({ className, hoverable, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        "border-b border-slate-50 last:border-0 dark:border-slate-800/60",
        hoverable && "hover:bg-slate-50/60 dark:hover:bg-slate-800/40",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-3.5 text-slate-500 dark:text-slate-400", className)} {...props} />;
}

export function TableFootnote({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500">{children}</p>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
        {children}
      </td>
    </tr>
  );
}
