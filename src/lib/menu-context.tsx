"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { menuItemsStore } from "@/lib/menu-store";
import { useAccessControl } from "@/lib/access-control-context";
import type { MenuItem, PermissionModule } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface MenuDraft {
  label: string;
  icon: string;
  href: string;
  parentId: string | null;
  module?: PermissionModule;
  roleIds?: string[];
}

interface MenuContextValue {
  menuItems: MenuItem[];
  visibleTopLevel: () => MenuItem[];
  visibleChildrenOf: (parentId: string) => MenuItem[];
  isVisible: (item: MenuItem) => boolean;
  canManageMenu: boolean;
  createMenuItem: (input: MenuDraft) => ActionResult;
  updateMenuItem: (id: string, patch: Partial<MenuDraft>) => ActionResult;
  deleteMenuItem: (id: string) => ActionResult;
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const { currentUser, canModule, canFeature } = useAccessControl();

  const menuItems = useSyncExternalStore(menuItemsStore.subscribe, menuItemsStore.getSnapshot, menuItemsStore.getServerSnapshot);

  const canManageMenu = canFeature("access-control.menu", "edit") || canFeature("access-control.menu", "manage");
  const myRoleIds = useMemo(() => currentUser.roles.map((r) => r.id), [currentUser.roles]);

  const isVisible = useCallback(
    (item: MenuItem) => {
      const roleAllows = item.roleIds ? item.roleIds.some((r) => myRoleIds.includes(r)) : true;
      const moduleAllows = item.module ? canModule(item.module, "view") : true;
      return roleAllows && moduleAllows;
    },
    [myRoleIds, canModule],
  );

  const sortByOrder = (a: MenuItem, b: MenuItem) => a.order - b.order;

  const visibleTopLevel = useCallback(
    () => menuItems.filter((m) => m.parentId === null && isVisible(m)).sort(sortByOrder),
    [menuItems, isVisible],
  );

  const visibleChildrenOf = useCallback(
    (parentId: string) => menuItems.filter((m) => m.parentId === parentId && isVisible(m)).sort(sortByOrder),
    [menuItems, isVisible],
  );

  const createMenuItem = useCallback(
    (input: MenuDraft): ActionResult => {
      if (!canManageMenu) return { ok: false, message: "You're not authorized to manage the menu." };
      const item: MenuItem = {
        id: `menu-${Date.now().toString(36)}`,
        order: menuItemsStore.getSnapshot().filter((m) => m.parentId === input.parentId).length + 1,
        ...input,
      };
      menuItemsStore.set([...menuItemsStore.getSnapshot(), item]);
      return { ok: true, message: `${input.label} added to the menu.` };
    },
    [canManageMenu],
  );

  const updateMenuItem = useCallback(
    (id: string, patch: Partial<MenuDraft>): ActionResult => {
      if (!canManageMenu) return { ok: false, message: "You're not authorized to manage the menu." };
      const existing = menuItemsStore.getSnapshot().find((m) => m.id === id);
      if (!existing) return { ok: false, message: "Menu item not found." };
      menuItemsStore.set(menuItemsStore.getSnapshot().map((m) => (m.id === id ? { ...m, ...patch } : m)));
      return { ok: true, message: `${existing.label} updated.` };
    },
    [canManageMenu],
  );

  const deleteMenuItem = useCallback(
    (id: string): ActionResult => {
      if (!canManageMenu) return { ok: false, message: "You're not authorized to manage the menu." };
      const existing = menuItemsStore.getSnapshot().find((m) => m.id === id);
      if (!existing) return { ok: false, message: "Menu item not found." };
      const hasChildren = menuItemsStore.getSnapshot().some((m) => m.parentId === id);
      if (hasChildren) return { ok: false, message: `Remove ${existing.label}'s submenus first.` };
      menuItemsStore.set(menuItemsStore.getSnapshot().filter((m) => m.id !== id));
      return { ok: true, message: `${existing.label} removed from the menu.` };
    },
    [canManageMenu],
  );

  const value = useMemo<MenuContextValue>(
    () => ({
      menuItems,
      visibleTopLevel,
      visibleChildrenOf,
      isVisible,
      canManageMenu,
      createMenuItem,
      updateMenuItem,
      deleteMenuItem,
    }),
    [menuItems, visibleTopLevel, visibleChildrenOf, isVisible, canManageMenu, createMenuItem, updateMenuItem, deleteMenuItem],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used within a MenuProvider");
  return ctx;
}
