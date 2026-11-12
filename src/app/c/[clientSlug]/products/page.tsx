import type { Metadata } from "next";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { productRows, type ProductRow } from "@/lib/calc";
import { loadAll } from "@/lib/data";
import { requireClientPage } from "@/lib/session";
import { int, money, pct, tone } from "@/lib/format";

export const metadata: Metadata = { title: "Product Analysis" };
export const dynamic = "force-dynamic";

function List({ title, rows, value, empty }: { title: string; rows: ProductRow[]; value: (r: ProductRow) => string; empty: string }) {
  return (
    <Card title={title} tone="accent">
      {rows.length ? (
        <ul>
          {rows.map((r) => (
            <li key={r.productName + r.sku} className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2 text-sm last:border-0">
              <span className="truncate" title={r.productName}>{r.productName}{r.sku && <span className="ml-1 text-xs text-muted">{r.sku}</span>}</span>
              <span className="num shrink-0 font-semibold">{value(r)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted">{empty}</p>
      )}
    </Card>
  );
}

type Params = Promise<{ clientSlug: string }>;

export default async function ProductsPage({ params }: { params: Params }) {
  const { client } = await requireClientPage((await params).clientSlug);
  const { orders, settings } = await loadAll(client.id);
  const rows = productRows(orders, settings);
  const top = rows.filter((r) => r.profit > 0).slice(0, 5);
  const low = rows.filter((r) => r.result === "Low margin");
  const losses = rows.filter((r) => r.profit < 0).sort((a, b) => a.profit - b.profit);
  const best = [...rows].sort((a, b) => b.units - a.units).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Product Performance"
        subtitle={`${client.name}. All-time totals in ${settings.reportingCurrency}, cancelled orders excluded, sorted by profit. Low margin means below ${pct(settings.lowMarginThreshold)}.`}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <List title="Most profitable (top 5)" rows={top} value={(r) => money(r.profit)} empty="No profitable products yet" />
        <List title="Low profit margin" rows={low} value={(r) => pct(r.margin)} empty="None" />
        <List title="Generating losses" rows={losses} value={(r) => money(r.profit)} empty="None" />
        <List title="Best-selling (top 5 by units)" rows={best} value={(r) => `${int(r.units)} units`} empty="No sales yet" />
      </div>
      {!rows.length ? (
        <Empty>No orders yet. Product results appear here once you add orders.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="text-right">Units sold</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Product cost</th>
                <th className="text-right">TikTok fees</th>
                <th className="text-right">Total order costs</th>
                <th className="text-right">Total profit</th>
                <th className="text-right">Avg profit / unit</th>
                <th className="text-right">Margin</th>
                <th className="text-right">ROI</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productName + r.sku} className={r.result === "Loss" ? "bg-neg-soft/40" : r.result === "Low margin" ? "bg-warn-soft/50" : ""}>
                  <td className="max-w-64 truncate font-medium" title={r.productName}>{r.productName}</td>
                  <td className="text-xs text-muted">{r.sku}</td>
                  <td className="num text-right">{int(r.units)}</td>
                  <td className="num text-right">{money(r.revenue)}</td>
                  <td className="num text-right">{money(r.productCost)}</td>
                  <td className="num text-right">{money(r.tiktokFees)}</td>
                  <td className="num text-right">{money(r.orderExpenses)}</td>
                  <td className={`num text-right font-semibold ${tone(r.profit)}`}>{money(r.profit)}</td>
                  <td className="num text-right">{money(r.profitPerUnit)}</td>
                  <td className="num text-right">{pct(r.margin)}</td>
                  <td className="num text-right">{pct(r.roi)}</td>
                  <td><Badge>{r.result}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
