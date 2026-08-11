"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedRegularizations } from "@/lib/regularization-data";
import type { AttendanceRegularization } from "@/lib/types";

export const regularizationsStore = createLocalStorageStore<AttendanceRegularization[]>(
  "hrms_attendance_regularizations",
  seedRegularizations,
);
