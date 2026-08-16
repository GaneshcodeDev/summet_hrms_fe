/**
 * Shared date helpers (Phase 17 hardening — section 21).
 *
 * The app stores every date as a plain "YYYY-MM-DD" string (never a Date
 * object, never a timestamp) — this file standardizes how those strings are
 * produced/read/compared/displayed, replacing the ad-hoc `new
 * Date().toISOString().slice(0, 10)` / `formatDate()` pairs that were
 * copy-pasted into a dozen+ page files. New code should use these; existing
 * call sites are migrated opportunistically, not in a blanket rewrite (see
 * docs/architecture-audit.md).
 *
 * Not timezone-aware in the way a real backend would be — this is a
 * client-only prototype (see docs/production-readiness.md) and every date
 * is interpreted in the browser's local timezone, matching how the rest of
 * the app already behaves.
 */

/** Today as "YYYY-MM-DD" in local time — the one true replacement for the `todayStr()` duplicated across pages. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** A Date (or now) formatted as "YYYY-MM-DD". */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a "YYYY-MM-DD" string as a local-midnight Date — never `new Date(str)` directly, which some browsers parse as UTC and shift by a day when displayed locally. */
export function parseDateStr(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** The "YYYY-MM" month bucket for a date string — works whether given a plain "YYYY-MM-DD" or a full ISO timestamp, since both start with "YYYY-MM". */
export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Human display, e.g. "16 Aug 2026". Pass a full ISO timestamp or a plain date string. */
export function formatDate(dateStr?: string, locale = "en-IN"): string {
  if (!dateStr) return "—";
  const iso = dateStr.length > 10 ? dateStr : `${dateStr}T00:00:00`;
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/** Human display with time, e.g. "16 Aug 2026, 9:05 am". Expects a full ISO timestamp. */
export function formatDateTime(iso?: string, locale = "en-IN"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** -1 / 0 / 1 — a real comparator, not string comparison sprinkled ad-hoc across sort() calls. Works correctly for both "YYYY-MM-DD" and full ISO timestamps since both compare correctly as strings, but this documents the intent and centralizes the operator choice. */
export function compareDateStrs(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isBeforeDate(a: string, b: string): boolean {
  return a < b;
}

export function isAfterDate(a: string, b: string): boolean {
  return a > b;
}

/** Inclusive range check — a <= x <= b. */
export function isWithinRange(x: string, a: string, b: string): boolean {
  return x >= a && x <= b;
}

/** Days between two "YYYY-MM-DD" strings (b - a), ignoring time-of-day. */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseDateStr(b).getTime() - parseDateStr(a).getTime()) / msPerDay);
}
