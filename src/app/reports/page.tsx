import type { Metadata } from "next";
import Link from "next/link";
import { MonthlyTrendChart } from "@/components/Charts";
import { PageHeader } from "@/components/ui";
import { monthlyRows, type MonthRow } from "@/lib/calc";
import { loadAll } from "@/lib/data";
import { requirePage } from "@/lib/session";
import { int, money, pct, tone } from "@/lib/format";

export const metadata: Metadata = { title: "Monthly Reports" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

const COLS: { key: keyof MonthRow; label: string; kind: "int" | "money" | "pct" | "signed" }[] = [
  { key: "orders", label: "Orders", kind: "int" },
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "productCost", label: "Product costs", kind: "money" },
  { key: "tiktokFees", label: "TikTok fees", kind: "money" },
  { key: "taxes", label: "Taxes", kind: "money" },
  { key: "shippingPackaging", label: "Shipping & packaging", kind: "money" },
  { key: "adCost", label: "Advertising", kind: "money" },
  { key: "otherCosts", label: "Other order costs", kind: "money" },
  { key: "orderExpenses", label: "Total order costs", kind: "money" },
  { key: "grossProfit", label: "Gross profit", kind: "signed" },
  { key: "grossMargin", label: "Gross margin", kind: "pct" },
  { key: "businessExpenses", label: "Business expenses", kind: "money" },
  { key: "netProfit", label: "Net profit", kind: "signed" },
  { key: "netMargin", label: "Net margin", kind: "pct" },
  { key: "roi", label: "ROI", kind: "pct" },
  { key: "changeVsPrior", label: "Net profit vs prior month", kind: "signed" },
];

function cell(v: number | null, kind: string) {
  if (v === null) return <span className="text-muted">-</span>;
  if (kind === "int") return int(v);
  if (kind === "pct") return pct(v);
  if (kind === "signed") return <span className={`font-semibold ${tone(v)}`}>{money(v)}</span>;
  return money(v);
}

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requirePage();
  const { orders, expenses, settings, today } = await loadAll();
  const thisYear = Number(today.slice(0, 4));
  const raw = Number(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const year = Number.isInteger(raw) && raw > 1999 && raw < 2101 ? raw : thisYear;
  const rows = monthlyRows(orders, expenses, `${year}-01-01`);

  const sum = (k: keyof MonthRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const t = {
    revenue: sum("revenue"), orderExpenses: sum("orderExpenses"), grossProfit: sum("grossProfit"),
    businessExpenses: sum("businessExpenses"), netProfit: sum("netProfit"),
  };
  const totals: Record<string, number | null> = {
    orders: sum("orders"), revenue: t.revenue, productCost: sum("productCost"), tiktokFees: sum("tiktokFees"),
    taxes: sum("taxes"), shippingPackaging: sum("shippingPackaging"), adCost: sum("adCost"), otherCosts: sum("otherCosts"),
    orderExpenses: t.orderExpenses, grossProfit: t.grossProfit, grossMargin: t.revenue ? t.grossProfit / t.revenue : 0,
    businessExpenses: t.businessExpenses, netProfit: t.netProfit, netMargin: t.revenue ? t.netProfit / t.revenue : 0,
    roi: t.orderExpenses + t.businessExpenses ? t.netProfit / (t.orderExpenses + t.businessExpenses) : 0, changeVsPrior: null,
  };

  return (
    <>
      <PageHeader
        title="Monthly Profit & Loss"
        subtitle={`Amounts in ${settings.reportingCurrency}. Cancelled orders excluded. Compare months to see whether the business is becoming more profitable.`}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            <Link href={`/reports?year=${year - 1}`} className="rounded-md px-3 py-1.5 text-sm hover:bg-canvas" aria-label="Previous year">←</Link>
            <span className="px-2 text-sm font-semibold text-navy">{year}</span>
            <Link href={`/reports?year=${year + 1}`} className="rounded-md px-3 py-1.5 text-sm hover:bg-canvas" aria-label="Next year">→</Link>
          </div>
        }
      />
      <div className="table-wrap mb-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              {COLS.map((c) => <th key={c.key} className="text-right">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="font-medium">{r.label}</td>
                {COLS.map((c) => <td key={c.key} className="num text-right">{cell(r[c.key] as number | null, c.kind)}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-canvas font-semibold">
              <td className="px-3 py-2.5">Total</td>
              {COLS.map((c) => <td key={c.key} className="num px-3 text-right">{cell(totals[c.key], c.kind)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <MonthlyTrendChart rows={rows.map((r) => ({ label: r.label.slice(0, 3), revenue: r.revenue, grossProfit: r.grossProfit, netProfit: r.netProfit }))} />
    </>
  );
}
