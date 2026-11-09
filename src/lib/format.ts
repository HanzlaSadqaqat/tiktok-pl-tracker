/** Accounting style: 1,234.56 / (1,234.56) / "-" for zero. */
export function money(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "-";
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

export function pct(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) < 0.0005) return "-";
  const s = `${(Math.abs(v) * 100).toFixed(1)}%`;
  return v < 0 ? `(${s})` : s;
}

export function int(v: number): string {
  return Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : "0";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-08" -> "8 Nov 2026". */
export function niceDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

export const tone = (v: number) => (v > 0.005 ? "text-pos" : v < -0.005 ? "text-neg" : "text-ink");
