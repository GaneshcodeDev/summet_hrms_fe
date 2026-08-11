"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedMenuItems } from "@/lib/menu-data";
import type { MenuItem } from "@/lib/types";

export const menuItemsStore = createLocalStorageStore<MenuItem[]>("hrms_menu_items", seedMenuItems);
