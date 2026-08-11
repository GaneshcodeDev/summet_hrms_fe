"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "hrms_theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let themeListeners: Array<() => void> = [];

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  themeListeners.push(listener);
  return () => {
    themeListeners = themeListeners.filter((l) => l !== listener);
  };
}

function getThemeSnapshot(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function getThemeServerSnapshot(): Theme {
  return "system";
}

function subscribeSystemPreference(listener: () => void) {
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}

function getSystemPrefersDarkSnapshot() {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getSystemPrefersDarkServerSnapshot() {
  return false;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemPreference,
    getSystemPrefersDarkSnapshot,
    getSystemPrefersDarkServerSnapshot,
  );

  const resolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    emitThemeChange();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var m=window.matchMedia('${MEDIA_QUERY}').matches;var d=t==='dark'||((t!=='light')&&m);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
