"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedEvents } from "@/lib/event-data";
import type { CompanyEvent } from "@/lib/types";

export const eventsStore = createLocalStorageStore<CompanyEvent[]>("hrms_events", seedEvents);
