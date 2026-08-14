"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { AttendanceRegularization } from "@/lib/types";

// Real product starts with zero attendance records — see demo-seed.ts for the optional rich dataset.
export const regularizationsStore = createLocalStorageStore<AttendanceRegularization[]>(
  "hrms_attendance_regularizations",
  [],
);
