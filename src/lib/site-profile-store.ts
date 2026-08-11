"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedEmployeeSiteMappings, seedSiteProfiles } from "@/lib/site-profile-data";
import type { EmployeeSiteMapping, SiteProfile } from "@/lib/types";

export const siteProfilesStore = createLocalStorageStore<SiteProfile[]>("hrms_site_profiles", seedSiteProfiles);
export const employeeSiteMappingsStore = createLocalStorageStore<EmployeeSiteMapping[]>(
  "hrms_employee_site_mappings",
  seedEmployeeSiteMappings,
);
