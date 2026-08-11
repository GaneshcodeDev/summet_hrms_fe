import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SiteProvider } from "@/lib/site-context";
import { AccessControlProvider } from "@/lib/access-control-context";
import { OrgProvider } from "@/lib/org-context";
import { SiteProfileProvider } from "@/lib/site-profile-context";
import { MasterProvider } from "@/lib/master-context";
import { SettingsProvider } from "@/lib/settings-context";
import { LeaveProvider } from "@/lib/leave-context";
import { PayrollProvider } from "@/lib/payroll-context";
import { EventProvider } from "@/lib/event-context";
import { MenuProvider } from "@/lib/menu-context";
import { RegularizationProvider } from "@/lib/regularization-context";
import { AccessGuard } from "@/components/auth/access-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AccessControlProvider>
      <SiteProvider>
        <OrgProvider>
          <SiteProfileProvider>
            <MasterProvider>
              <SettingsProvider>
                <LeaveProvider>
                  <PayrollProvider>
                    <EventProvider>
                      <MenuProvider>
                        <RegularizationProvider>
                          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
                            <Sidebar />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <Topbar />
                              <main className="flex-1 p-4 sm:p-6">
                                <AccessGuard>{children}</AccessGuard>
                              </main>
                            </div>
                          </div>
                        </RegularizationProvider>
                      </MenuProvider>
                    </EventProvider>
                  </PayrollProvider>
                </LeaveProvider>
              </SettingsProvider>
            </MasterProvider>
          </SiteProfileProvider>
        </OrgProvider>
      </SiteProvider>
    </AccessControlProvider>
  );
}
