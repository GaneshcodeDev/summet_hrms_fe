import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SiteProvider } from "@/lib/site-context";
import { AccessControlProvider } from "@/lib/access-control-context";
import { OrgProvider } from "@/lib/org-context";
import { MasterProvider } from "@/lib/master-context";
import { AccessGuard } from "@/components/auth/access-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AccessControlProvider>
      <SiteProvider>
        <OrgProvider>
          <MasterProvider>
            <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main className="flex-1 p-4 sm:p-6">
                  <AccessGuard>{children}</AccessGuard>
                </main>
              </div>
            </div>
          </MasterProvider>
        </OrgProvider>
      </SiteProvider>
    </AccessControlProvider>
  );
}
