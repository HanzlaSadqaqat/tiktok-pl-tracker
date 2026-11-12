import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodFilter } from "@/components/PeriodFilter";
import { Empty, PageHeader } from "@/components/ui";
import { PERIODS, type Period } from "@/lib/constants";
import { loadOverview, timeZone, type OverviewRow } from "@/lib/data";
import { int, money, niceDate, pct, tone } from "@/lib/format";
import { resolvePeriod, todayIn } from "@/lib/periods";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "All clients" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function rowTone(r: OverviewRow) {
  if (r.orders === 0 && r.businessExpenses === 0) return "";
  if (r.netProfit < 0) return "bg-neg-soft/40";
  if (r.netMargin < r.lowMarginThreshold) return "bg-warn-soft/50";
  return "";
}

export default async function OverviewPage({ searchParams }: { searchParams: SP }) {
  await requirePage("admin");
  const sp = await searchParams;
  const raw = one(sp.period);
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "This Month";
  const { start, end } = resolvePeriod(period, todayIn(timeZone()), one(sp.start), one(sp.end));
  const rows = await loadOverview(start, end);

  // One total per currency: amounts in different currencies are never added together.
  const totals = new Map<string, { clients: number; orders: number; revenue: number; grossProfit: number; businessExpenses: number; netProfit: number }>();
  for (const r of rows) {
    const t = totals.get(r.currency) ?? { clients: 0, orders: 0, revenue: 0, grossProfit: 0, businessExpenses: 0, netProfit: 0 };
    totals.set(r.currency, {
      clients: t.clients + 1,
      orders: t.orders + r.orders,
      revenue: t.revenue + r.revenue,
      grossProfit: t.grossProfit + r.grossProfit,
      businessExpenses: t.businessExpenses + r.businessExpenses,
      netProfit: t.netProfit + r.netProfit,
    });
  }
  const allTime = period === "All Time" || (period === "Custom Range" && start === "2000-01-01" && end === "2100-12-31");

  return (
    <>
      <PageHeader
        title="All clients"
        subtitle="Each client in its own reporting currency. Red: net loss. Yellow: net margin below that client's low-margin threshold."
        actions={<Link href="/clients/manage" className="btn-secondary">Manage clients</Link>}
      />
      <div className="mb-6 flex flex-col gap-2">
        <Suspense>
          <PeriodFilter period={period} start={start} end={end} />
        </Suspense>
        <p className="text-xs text-muted">Showing {allTime ? "all dates" : `${niceDate(start)} to ${niceDate(end)}`}</p>
      </div>

      {!rows.length ? (
        <Empty>
          No active clients yet. <Link href="/clients/manage" className="font-medium text-accent hover:underline">Create your first client</Link>.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Currency</th>
                <th className="text-right">Orders</th>
                <th className="calc text-right">Revenue</th>
                <th className="calc text-right">Gross profit</th>
                <th className="calc text-right">Business expenses</th>
                <th className="calc text-right">Net profit</th>
                <th className="calc text-right">Net margin</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client.id} className={rowTone(r)}>
                  <td>
                    <Link href={`/c/${r.client.slug}`} className="font-medium text-accent hover:underline">{r.client.name}</Link>
                    {(r.client.shopName || r.client.marketplace) && (
                      <span className="block text-xs text-muted">{[r.client.shopName, r.client.marketplace].filter(Boolean).join(" · ")}</span>
                    )}
                    {r.fxMissing && <span className="block text-xs text-warn">Missing exchange rate</span>}
                  </td>
                  <td className="text-xs font-medium text-muted">{r.currency}</td>
                  <td className="num text-right">{int(r.orders)}</td>
                  <td className="num text-right">{money(r.revenue)}</td>
                  <td className={`num text-right ${tone(r.grossProfit)}`}>{money(r.grossProfit)}</td>
                  <td className="num text-right">{money(r.businessExpenses)}</td>
                  <td className={`num text-right font-semibold ${tone(r.netProfit)}`}>{money(r.netProfit)}</td>
                  <td className={`num text-right ${tone(r.netMargin)}`}>{pct(r.netMargin)}</td>
                  <td className="whitespace-nowrap text-sm">{r.lastOrderDate ? niceDate(r.lastOrderDate) : <span className="text-muted">None</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {[...totals.entries()].map(([cur, t]) => (
                <tr key={cur} className="bg-canvas font-semibold">
                  <td className="px-3 py-2.5">Total ({t.clients} client{t.clients === 1 ? "" : "s"})</td>
                  <td className="px-3 text-xs">{cur}</td>
                  <td className="num px-3 text-right">{int(t.orders)}</td>
                  <td className="num px-3 text-right">{money(t.revenue)}</td>
                  <td className={`num px-3 text-right ${tone(t.grossProfit)}`}>{money(t.grossProfit)}</td>
                  <td className="num px-3 text-right">{money(t.businessExpenses)}</td>
                  <td className={`num px-3 text-right ${tone(t.netProfit)}`}>{money(t.netProfit)}</td>
                  <td className={`num px-3 text-right ${tone(t.netProfit)}`}>{pct(t.revenue ? t.netProfit / t.revenue : 0)}</td>
                  <td />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
