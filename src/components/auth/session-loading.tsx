import { Loader2 } from "lucide-react";

/** Shown only for the brief window before the session cookie has been checked — see AccessGuard. */
export function SessionLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-300 dark:text-slate-600" />
    </div>
  );
}
