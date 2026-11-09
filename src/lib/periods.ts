import type { Period } from "./constants";
import type { ISODate } from "./types";

const pad = (v: number) => String(v).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: ISODate) => new Date(`${s}T00:00:00Z`);

/** Today's date in the given IANA time zone, as "YYYY-MM-DD". */
export function todayIn(timeZone: string, now = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(d: ISODate, days: number): ISODate {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + days);
  return fmt(x);
}

export function monthStart(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function monthEnd(d: ISODate): ISODate {
  const x = parse(monthStart(d));
  x.setUTCMonth(x.getUTCMonth() + 1);
  x.setUTCDate(0);
  return fmt(x);
}

export function addMonths(d: ISODate, months: number): ISODate {
  const x = parse(monthStart(d));
  x.setUTCMonth(x.getUTCMonth() + months);
  return fmt(x);
}

export const isISODate = (s: unknown): s is ISODate =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime()) && fmt(parse(s)) === s;

const ALL_START = "2000-01-01";
const ALL_END = "2100-12-31";

/** Start and end dates (inclusive) for a dashboard period. Weeks start on Monday. */
export function resolvePeriod(
  period: Period,
  today: ISODate,
  customStart?: string | null,
  customEnd?: string | null,
): { start: ISODate; end: ISODate } {
  switch (period) {
    case "Today":
      return { start: today, end: today };
    case "This Week": {
      const dow = (parse(today).getUTCDay() + 6) % 7; // Monday = 0
      const start = addDays(today, -dow);
      return { start, end: addDays(start, 6) };
    }
    case "This Month":
      return { start: monthStart(today), end: monthEnd(today) };
    case "Last Month": {
      const start = addMonths(today, -1);
      return { start, end: monthEnd(start) };
    }
    case "This Year":
      return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` };
    case "Custom Range":
      return {
        start: isISODate(customStart) ? customStart : ALL_START,
        end: isISODate(customEnd) ? customEnd : ALL_END,
      };
    case "All Time":
    default:
      return { start: ALL_START, end: ALL_END };
  }
}
