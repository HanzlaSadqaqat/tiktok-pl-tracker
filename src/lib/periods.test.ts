import { describe, expect, it } from "vitest";
import { addMonths, isISODate, monthEnd, resolvePeriod, todayIn } from "./periods";
import { parseCsv, rowsToRecords, toISODate, toNumber } from "./csv";

describe("periods", () => {
  const today = "2026-11-10"; // a Tuesday

  it("resolves each period", () => {
    expect(resolvePeriod("Today", today)).toEqual({ start: today, end: today });
    expect(resolvePeriod("This Week", today)).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(resolvePeriod("This Month", today)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(resolvePeriod("Last Month", today)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(resolvePeriod("This Year", today)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(resolvePeriod("Custom Range", today, "2026-05-01", "2026-05-15")).toEqual({ start: "2026-05-01", end: "2026-05-15" });
    expect(resolvePeriod("Custom Range", today, "bad", null).start).toBe("2000-01-01");
  });

  it("handles month edges", () => {
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(isISODate("2026-02-30")).toBe(false);
  });

  it("uses the requested time zone for today", () => {
    const instant = new Date("2026-11-09T20:30:00Z");
    expect(todayIn("Asia/Karachi", instant)).toBe("2026-11-10");
    expect(todayIn("America/New_York", instant)).toBe("2026-11-09");
  });
});

describe("csv", () => {
  it("parses quotes, commas and the sheet's banner row", () => {
    const text = 'ORDER INFORMATION,,\r\nOrder Date,Order ID,"Notes, misc"\r\n8 Nov 2026,577123456789012345,"He said ""hi"""\r\n';
    const recs = rowsToRecords(parseCsv(text));
    expect(recs).toEqual([{ orderdate: "8 Nov 2026", orderid: "577123456789012345", notesmisc: 'He said "hi"' }]);
  });

  it("reads numbers and dates in sheet formats", () => {
    expect(toNumber("(1,234.50)")).toBe(-1234.5);
    expect(toNumber("-")).toBe(0);
    expect(toNumber("$12")).toBe(12);
    expect(toISODate("8 Nov 2026")).toBe("2026-11-08");
    expect(toISODate("08/11/2026")).toBe("2026-11-08");
    expect(toISODate("2026-11-08")).toBe("2026-11-08");
    expect(toISODate("nope")).toBeNull();
  });
});
