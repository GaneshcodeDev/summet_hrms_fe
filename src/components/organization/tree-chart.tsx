import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ChartNode {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  href?: string;
  muted?: boolean;
  children?: ChartNode[];
}

function NodeCard({ node, isRoot }: { node: ChartNode; isRoot?: boolean }) {
  const content = (
    <>
      <Avatar name={node.label} size="md" />
      <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{node.label}</p>
      {node.sublabel && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{node.sublabel}</p>}
      {node.badge && (
        <Badge tone="indigo" className="mt-1">
          {node.badge}
        </Badge>
      )}
    </>
  );

  const className = cn(
    "flex w-44 flex-col items-center gap-1 rounded-xl border bg-white px-3 py-3 text-center shadow-sm transition-shadow dark:bg-slate-900 dark:shadow-none",
    isRoot
      ? "border-indigo-200 ring-2 ring-indigo-100 dark:border-indigo-500/40 dark:ring-indigo-500/20"
      : "border-slate-100 dark:border-slate-800",
    node.muted && "opacity-60",
    node.href && "hover:shadow-md",
  );

  if (node.href) {
    return (
      <Link href={node.href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

/** Generic recursive tree-chart renderer — connects nodes with box-and-line connectors. */
export function TreeChart({ node, isRoot = true }: { node: ChartNode; isRoot?: boolean }) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} isRoot={isRoot} />
      {hasChildren && (
        <>
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
          <div className="relative flex">
            <div className="absolute left-0 right-0 top-0 h-px bg-slate-300 dark:bg-slate-700" />
            <div className="flex gap-8 pt-6">
              {node.children!.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <div className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-700" />
                  <TreeChart node={child} isRoot={false} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
