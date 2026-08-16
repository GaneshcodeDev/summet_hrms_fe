import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SiteProvider } from "@/lib/site-context";
import { AccessControlProvider } from "@/lib/access-control-context";
import { NotificationProvider } from "@/lib/notification-context";
import { EmployeeProvider } from "@/lib/employee-context";
import { SiteConfigProvider } from "@/lib/site-config-context";
import { AttendanceProvider } from "@/lib/attendance-context";
import { OrgProvider } from "@/lib/org-context";
import { SiteProfileProvider } from "@/lib/site-profile-context";
import { MasterProvider } from "@/lib/master-context";
import { SettingsProvider } from "@/lib/settings-context";
import { ApprovalProvider } from "@/lib/approval-context";
import { EmployeeLifecycleProvider } from "@/lib/employee-lifecycle-context";
import { LeaveProvider } from "@/lib/leave-context";
import { PayrollProvider } from "@/lib/payroll-context";
import { PerformanceProvider } from "@/lib/performance-context";
import { SkillsProvider } from "@/lib/skills-context";
import { TrainingProvider } from "@/lib/training-context";
import { AssetProvider } from "@/lib/asset-context";
import { ExpenseProvider } from "@/lib/expense-context";
import { EventProvider } from "@/lib/event-context";
import { MenuProvider } from "@/lib/menu-context";
import { RegularizationProvider } from "@/lib/regularization-context";
import { OnboardingProvider } from "@/lib/onboarding-context";
import { RecruitmentProvider } from "@/lib/recruitment-context";
import { OffboardingProvider } from "@/lib/offboarding-context";
import { AccessGuard } from "@/components/auth/access-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AccessControlProvider>
      <NotificationProvider>
      <SiteProvider>
        <EmployeeProvider>
          <SiteConfigProvider>
            <AttendanceProvider>
              <OrgProvider>
                <SiteProfileProvider>
                  <MasterProvider>
                    <SettingsProvider>
                      <ApprovalProvider>
                        <EmployeeLifecycleProvider>
                          <LeaveProvider>
                            <PayrollProvider>
                              <PerformanceProvider>
                              <SkillsProvider>
                              <TrainingProvider>
                              <AssetProvider>
                              <ExpenseProvider>
                                <EventProvider>
                                  <MenuProvider>
                                    <RegularizationProvider>
                                      <OnboardingProvider>
                                        <RecruitmentProvider>
                                          <OffboardingProvider>
                                            <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
                                              <Sidebar />
                                              <div className="flex min-w-0 flex-1 flex-col">
                                                <Topbar />
                                                <main className="flex-1 p-4 sm:p-6">
                                                  <AccessGuard>{children}</AccessGuard>
                                                </main>
                                              </div>
                                            </div>
                                          </OffboardingProvider>
                                        </RecruitmentProvider>
                                      </OnboardingProvider>
                                    </RegularizationProvider>
                                  </MenuProvider>
                                </EventProvider>
                              </ExpenseProvider>
                              </AssetProvider>
                              </TrainingProvider>
                              </SkillsProvider>
                              </PerformanceProvider>
                            </PayrollProvider>
                          </LeaveProvider>
                        </EmployeeLifecycleProvider>
                      </ApprovalProvider>
                    </SettingsProvider>
                  </MasterProvider>
                </SiteProfileProvider>
              </OrgProvider>
            </AttendanceProvider>
          </SiteConfigProvider>
        </EmployeeProvider>
      </SiteProvider>
      </NotificationProvider>
    </AccessControlProvider>
  );
}
