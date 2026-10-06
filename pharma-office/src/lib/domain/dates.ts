/**
 * Calendar-date helpers. All business dates are ISO "YYYY-MM-DD" strings in
 * the Asia/Baghdad calendar. Arithmetic is done in UTC on date-only values,
 * which avoids daylight-saving and server-timezone drift.
 */
export const BUSINESS_TIMEZONE = "Asia/Baghdad";

const DAY_MS = 86_400_000;

export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseISODate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Invalid ISO date: ${iso}`);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return d;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toISODate(target);
}

export function endOfMonth(iso: string): string {
  return addDays(startOfMonth(addMonths(startOfMonth(iso), 1)), -1);
}

/** The same calendar range shifted back by `months` (clamped to month end). */
export function shiftRangeMonths(range: { from: string; to: string }, months: number) {
  return { from: addMonths(range.from, months), to: addMonths(range.to, months) };
}
