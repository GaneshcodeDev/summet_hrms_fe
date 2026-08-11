"use client";

/**
 * Generic localStorage-backed external store for useSyncExternalStore.
 * Shared by SiteProvider and AccessControlProvider so tenant/session/RBAC
 * state all persist and broadcast changes the same way.
 */
export function createLocalStorageStore<T>(key: string, defaultValue: T) {
  let listeners: Array<() => void> = [];
  let cachedRaw: string | null | undefined;
  let cachedValue: T = defaultValue;

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }

  function getSnapshot(): T {
    const raw = localStorage.getItem(key);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (!raw) {
      cachedValue = defaultValue;
      return cachedValue;
    }
    try {
      cachedValue = JSON.parse(raw) as T;
    } catch {
      cachedValue = defaultValue;
    }
    return cachedValue;
  }

  function getServerSnapshot(): T {
    return defaultValue;
  }

  function set(value: T) {
    localStorage.setItem(key, JSON.stringify(value));
    emit();
  }

  function update(updater: (current: T) => T) {
    set(updater(getSnapshot()));
  }

  return { subscribe, getSnapshot, getServerSnapshot, set, update };
}
