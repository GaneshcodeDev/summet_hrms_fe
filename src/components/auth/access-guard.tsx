"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useAccessControl } from "@/lib/access-control-context";
import { moduleForPath } from "@/lib/route-permissions";
import { logSecurityEvent } from "@/lib/rbac-store";
import { Forbidden } from "@/components/auth/forbidden";

/** Page-level and module-level route protection for everything under the app shell. */
export function AccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { canModule, currentUser } = useAccessControl();
  const requiredModule = moduleForPath(pathname);
  const allowed = !requiredModule || canModule(requiredModule, "view");
  const lastLoggedPath = useRef<string | null>(null);

  useEffect(() => {
    if (allowed || !requiredModule || lastLoggedPath.current === pathname) return;
    lastLoggedPath.current = pathname;
    logSecurityEvent({
      type: "access_denied",
      accountId: currentUser.account?.id,
      actorName: currentUser.name,
      detail: `Blocked access to ${pathname} (missing '${requiredModule}' view permission)`,
      ip: "—",
    });
  }, [allowed, requiredModule, pathname, currentUser]);

  if (!allowed) return <Forbidden module={requiredModule} />;
  return <>{children}</>;
}
