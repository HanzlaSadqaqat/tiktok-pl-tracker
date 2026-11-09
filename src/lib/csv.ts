/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Turns rows into objects keyed by normalised header ("Sale Price / Unit" -> "salepriceunit"). */
export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
  const headerIndex = rows.findIndex((r) => r.some((c) => norm(c) === "orderid" || norm(c) === "expensename"));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(norm);
  return rows.slice(headerIndex + 1).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) rec[h] = (r[i] ?? "").trim();
    });
    return rec;
  });
}

/** Parses "1,234.50", "(12.00)", "$5" or "" into a number. */
export function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const s = v.replace(/[^0-9.()\-]/g, "");
  if (!s || s === "-") return 0;
  const neg = s.startsWith("(") && s.endsWith(")");
  const num = Number(s.replace(/[()]/g, ""));
  if (!Number.isFinite(num)) return 0;
  return neg ? -num : num;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Accepts "2026-11-08", "8 Nov 2026", "08/11/2026" (day first) and returns "YYYY-MM-DD" or null. */
export function toISODate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const pad = (x: number) => String(x).padStart(2, "0");
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}
