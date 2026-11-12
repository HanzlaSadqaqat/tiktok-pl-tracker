"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ORDER_STATUSES } from "@/lib/constants";
import { money, niceDate, pct } from "@/lib/format";
import type { AppSettings, OrderWithCalc } from "@/lib/types";
import { ImportCsv } from "./ImportCsv";
import { Modal } from "./Modal";
import { OrderForm } from "./OrderForm";
import { Badge, Empty, PageHeader } from "./ui";

const RESULT_ROW: Record<string, string> = {
  Loss: "bg-neg-soft/40",
  "Low margin": "bg-warn-soft/50",
  Cancelled: "text-muted italic",
};

export function OrdersClient({ clientId, clientName, today, canEdit }: { clientId: string; clientName: string; today: string; canEdit: boolean }) {
  const api = `/api/clients/${clientId}`;
  const [orders, setOrders] = useState<OrderWithCalc[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderWithCalc | "new" | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${api}/orders`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) return setError(data?.error ?? "Could not load orders");
    setError(null);
    setOrders(data.orders);
    setSettings(data.settings);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (!needle || [o.orderId, o.productName, o.sku, o.notes].some((v) => v.toLowerCase().includes(needle))) &&
        (!status || o.status === status) &&
        (!result || o.calc.result === result) &&
        (!from || o.orderDate >= from) &&
        (!to || o.orderDate <= to),
    );
  }, [orders, q, status, result, from, to]);

  const totals = useMemo(
    () =>
      shown.reduce(
        (a, o) => ({
          revenue: a.revenue + o.calc.revenue,
          costs: a.costs + o.calc.totalExpenses,
          profit: a.profit + o.calc.netProfit,
        }),
        { revenue: 0, costs: 0, profit: 0 },
      ),
    [shown],
  );

  async function remove(o: OrderWithCalc) {
    if (!confirm(`Delete order ${o.orderId}? This cannot be undone.`)) return;
    const res = await fetch(`${api}/orders/${o.id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json().catch(() => null))?.error ?? "Could not delete");
    load();
  }

  const cur = settings?.reportingCurrency ?? "";

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${clientName}. One row per TikTok Shop order. Profit columns are calculated automatically in ${cur || "your reporting currency"}.`}
        actions={
          canEdit && (
          <>
            <ImportCsv endpoint={`${api}/orders/import`} tabName="Orders" onDone={load} />
            <button className="btn-primary" onClick={() => setEditing("new")} disabled={!settings}>+ Add order</button>
          </>
          )
        }
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-line bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" className="field" placeholder="Order ID, product, SKU or notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fs">Status</label>
          <select id="fs" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fr">Result</label>
          <select id="fr" className="field" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">All results</option>
            {["Profitable", "Low margin", "Loss", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="ff">From</label>
            <input id="ff" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ft">To</label>
            <input id="ft" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}

      {loading && !orders.length ? (
        <Empty>Loading orders...</Empty>
      ) : !orders.length ? (
        <Empty>
          No orders yet. Add your first order, or import the Orders tab from your Google Sheet.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order ID</th>
                <th>Product</th>
                <th>Status</th>
                <th>Payout</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="calc text-right">Revenue</th>
                <th className="calc text-right">Product cost</th>
                <th className="calc text-right">TikTok fees</th>
                <th className="calc text-right">Total costs</th>
                <th className="calc text-right">Net profit</th>
                <th className="calc text-right">Margin</th>
                <th className="calc text-right">ROI</th>
                <th className="calc">Basis</th>
                <th className="calc">Result</th>
                <th className="calc"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} className={RESULT_ROW[o.calc.result] ?? ""}>
                  <td>{niceDate(o.orderDate)}</td>
                  <td className="font-mono text-xs">{o.orderId}</td>
                  <td className="max-w-56 truncate" title={o.productName}>
                    {o.productName}
                    {o.sku && <span className="ml-1 text-xs text-muted">{o.sku}</span>}
                  </td>
                  <td>{o.status}</td>
                  <td className="text-xs">{o.payoutStatus}</td>
                  <td className="num text-right">{o.quantity}</td>
                  <td className="num text-right">
                    {money(o.salePrice)} {o.currency !== cur && <span className="text-xs text-muted">{o.currency}</span>}
                  </td>
                  <td className="num text-right">{money(o.calc.revenue)}</td>
                  <td className="num text-right">{money(o.calc.productCost)}</td>
                  <td className="num text-right">{money(o.calc.tiktokFees)}</td>
                  <td className="num text-right">{money(o.calc.totalExpenses)}</td>
                  <td className={`num text-right font-semibold ${o.calc.netProfit < 0 ? "text-neg" : o.calc.netProfit > 0 ? "text-pos" : ""}`}>
                    {money(o.calc.netProfit)}
                  </td>
                  <td className="num text-right">{pct(o.calc.margin)}</td>
                  <td className="num text-right">{pct(o.calc.roi)}</td>
                  <td><Badge>{o.calc.basis}</Badge></td>
                  <td><Badge>{o.calc.result}</Badge></td>
                  <td className="text-right">
                    {canEdit && (
                      <>
                      <button className="mr-2 text-xs font-medium text-accent hover:underline" onClick={() => setEditing(o)}>Edit</button>
                      <button className="text-xs font-medium text-neg hover:underline" onClick={() => remove(o)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas font-semibold">
                <td colSpan={7} className="px-3 py-2.5 text-sm">
                  {shown.length} of {orders.length} orders
                </td>
                <td className="num px-3 text-right">{money(totals.revenue)}</td>
                <td colSpan={2} />
                <td className="num px-3 text-right">{money(totals.costs)}</td>
                <td className={`num px-3 text-right ${totals.profit < 0 ? "text-neg" : "text-pos"}`}>{money(totals.profit)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && settings && (
        <Modal title={editing === "new" ? "Add order" : `Edit order ${editing.orderId}`} onClose={() => setEditing(null)} wide>
          <OrderForm
            api={api}
            order={editing === "new" ? null : editing}
            settings={settings}
            today={today}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
