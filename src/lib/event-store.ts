"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { CompanyEvent } from "@/lib/types";

// Real product starts with zero events — see demo-seed.ts for the optional
// rich dataset (moved out of the default here in Phase 17; this store used
// to seed itself on every fresh install, which meant "Load Demo Data" never
// touched it and a brand-new tenant saw fake company events immediately).
export const eventsStore = createLocalStorageStore<CompanyEvent[]>("hrms_events", []);
