"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useAccessControl } from "@/lib/access-control-context";
import { moduleForPath } from "@/lib/route-permissions";
import { logSecurityEvent } from "@/lib/rbac-store";
import { Forbidden } from "@/components/auth/forbidden";
import { SessionLoading } from "@/components/auth/session-loading";

/** Page-level and module-level route protection for everything under the app shell. */
export function AccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { canModule, currentUser, sessionResolved } = useAccessControl();
  const requiredModule = moduleForPath(pathname);
  const allowed = !requiredModule || canModule(requiredModule, "view");
  const lastLoggedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionResolved || allowed || !requiredModule || lastLoggedPath.current === pathname) return;
    lastLoggedPath.current = pathname;
    logSecurityEvent({
      type: "access_denied",
      accountId: currentUser.account?.id,
      actorName: currentUser.name,
      detail: `Blocked access to ${pathname} (missing '${requiredModule}' view permission)`,
      ip: "—",
    });
  }, [sessionResolved, allowed, requiredModule, pathname, currentUser]);

  // Loading, not Forbidden, until the session cookie has actually been
  // checked once — otherwise every page flashes "Access Restricted" for the
  // ~300ms before the AccessControlProvider effect resolves currentAccount.
  if (!sessionResolved) return <SessionLoading />;
  if (!allowed) return <Forbidden module={requiredModule} />;
  return <>{children}</>;
}
