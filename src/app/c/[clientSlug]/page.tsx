import { Suspense } from "react";
import { DashboardCharts } from "@/components/Charts";
import { PeriodFilter } from "@/components/PeriodFilter";
import { Card, MetricRow, PageHeader } from "@/components/ui";
import { monthlyRows, summarize } from "@/lib/calc";
import { EXPENSE_CATEGORIES, ORDER_STATUSES, PERIODS, type Period } from "@/lib/constants";
import { loadAll } from "@/lib/data";
import { requireClientPage } from "@/lib/session";
import { int, money, niceDate, pct } from "@/lib/format";
import { addMonths, monthStart, resolvePeriod } from "@/lib/periods";

export const dynamic = "force-dynamic";

type Params = Promise<{ clientSlug: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const sp = await searchParams;
  const raw = one(sp.period);
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "This Month";
  const { client } = await requireClientPage((await params).clientSlug);
  const { orders, expenses, settings, today } = await loadAll(client.id);
  const { start, end } = resolvePeriod(period, today, one(sp.start), one(sp.end));
  const s = summarize(orders, expenses, start, end);

  // 12 months ending at the period end (or today, whichever is earlier).
  const anchor = end < today ? end : today;
  const trend = monthlyRows(orders, expenses, addMonths(monthStart(anchor), -11)).map((r) => ({
    label: r.label.replace(/ (\d{2})(\d{2})$/, " $2"),
    revenue: r.revenue,
    netProfit: r.netProfit,
    orderExpenses: r.orderExpenses,
    businessExpenses: r.businessExpenses,
    netMargin: r.netMargin,
  }));

  const inPeriod = orders.filter((o) => o.orderDate >= start && o.orderDate <= end);
  const byProduct = new Map<string, number>();
  for (const o of inPeriod) if (o.status !== "Cancelled") byProduct.set(o.productName, (byProduct.get(o.productName) ?? 0) + o.calc.revenue);
  const products = [...byProduct.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const categories = EXPENSE_CATEGORIES.map((name) => ({
    name,
    value: expenses.filter((e) => e.category === name && e.date >= start && e.date <= end).reduce((a, e) => a + e.amountReporting, 0),
  }));
  const statuses = ORDER_STATUSES.map((name) => ({ name, value: inPeriod.filter((o) => o.status === name).length }));
  const missingFx = [...new Set([...orders.filter((o) => o.calc.fxMissing).map((o) => o.currency), ...expenses.filter((e) => e.fxMissing).map((e) => e.currency)])];

  const allTime = period === "All Time" || (period === "Custom Range" && start === "2000-01-01" && end === "2100-12-31");

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={
          <>
            Profit &amp; loss dashboard. All amounts in {settings.reportingCurrency}. Gross profit = revenue minus order-level costs. Net profit = gross profit minus business expenses.
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-2">
        <Suspense>
          <PeriodFilter period={period} start={start} end={end} />
        </Suspense>
        <p className="text-xs text-muted">Showing {allTime ? "all dates" : `${niceDate(start)} to ${niceDate(end)}`}</p>
        {missingFx.length > 0 && (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            No exchange rate for {missingFx.join(", ")}. These amounts are counted 1:1 until you add a rate in Settings.
          </p>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title="Orders">
          <MetricRow label="Total orders" value={int(s.totalOrders)} />
          <MetricRow label="Delivered" value={int(s.delivered)} />
          <MetricRow label="In progress (pending, processing, shipped)" value={int(s.inProgress)} />
          <MetricRow label="Cancelled" value={int(s.cancelled)} />
          <MetricRow label="Returned" value={int(s.returned)} />
          <MetricRow label="Refunded" value={int(s.refunded)} />
          <MetricRow label="Counted orders (excl. cancelled)" value={int(s.countedOrders)} />
        </Card>
        <Card title="Revenue & Order Costs">
          <MetricRow label="Sales revenue (net of refunds)" value={money(s.revenue)} strong />
          <MetricRow label="Product costs" value={money(s.productCost)} />
          <MetricRow label="TikTok fees" value={money(s.tiktokFees)} />
          <MetricRow label="Taxes" value={money(s.taxes)} />
          <MetricRow label="Shipping & packaging" value={money(s.shippingPackaging)} />
          <MetricRow label="Advertising" value={money(s.adCost)} />
          <MetricRow label="Other order costs" value={money(s.otherCosts)} />
          <MetricRow label="Total order-level expenses" value={money(s.orderExpenses)} />
        </Card>
        <Card title="Profit">
          <MetricRow label="Gross profit" value={money(s.grossProfit)} signed={s.grossProfit} />
          <MetricRow label="Gross margin" value={pct(s.grossMargin)} signed={s.grossMargin} />
          <MetricRow label="Business expenses (operating)" value={money(s.businessExpenses)} />
          <MetricRow label="Net profit" value={money(s.netProfit)} signed={s.netProfit} strong />
          <MetricRow label="Net margin" value={pct(s.netMargin)} signed={s.netMargin} />
          <MetricRow label="Avg gross profit per order" value={money(s.avgGrossProfitPerOrder)} signed={s.avgGrossProfitPerOrder} />
          <MetricRow label="Overall ROI" value={pct(s.roi)} signed={s.roi} />
          <MetricRow label="Realized net profit (settled orders, returns)" value={money(s.realizedNetProfit)} signed={s.realizedNetProfit} />
          <MetricRow label="Estimated profit still pending" value={money(s.pendingProfit)} signed={s.pendingProfit} />
        </Card>
      </div>

      <DashboardCharts trend={trend} products={products} categories={categories} statuses={statuses} />
    </>
  );
}
