"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EXPENSE_CATEGORIES, PAYMENT_STATUSES } from "@/lib/constants";
import { money, niceDate } from "@/lib/format";
import { addMonths, monthEnd, monthStart } from "@/lib/periods";
import type { AppSettings, ExpenseWithCalc } from "@/lib/types";
import { ExpenseForm } from "./ExpenseForm";
import { ImportCsv } from "./ImportCsv";
import { Modal } from "./Modal";
import { Badge, Card, Empty, MetricRow, PageHeader } from "./ui";

export function ExpensesClient({ today }: { today: string }) {
  const [expenses, setExpenses] = useState<ExpenseWithCalc[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseWithCalc | "new" | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [pay, setPay] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/expenses", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) return setError(data?.error ?? "Could not load expenses");
    setError(null);
    setExpenses(data.expenses);
    setSettings(data.settings);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return expenses.filter(
      (e) =>
        (!needle || [e.name, e.description].some((v) => v.toLowerCase().includes(needle))) &&
        (!category || e.category === category) &&
        (!pay || e.paymentStatus === pay),
    );
  }, [expenses, q, category, pay]);

  const summary = useMemo(() => {
    const sum = (f: (e: ExpenseWithCalc) => boolean) => expenses.filter(f).reduce((a, e) => a + e.amountReporting, 0);
    const tm0 = monthStart(today);
    const lm0 = addMonths(today, -1);
    const y = today.slice(0, 4);
    const last12Start = addMonths(today, -12);
    return {
      total: sum(() => true),
      paid: sum((e) => e.paymentStatus === "Paid"),
      pending: sum((e) => e.paymentStatus === "Pending"),
      thisMonth: sum((e) => e.date >= tm0 && e.date <= monthEnd(today)),
      lastMonth: sum((e) => e.date >= lm0 && e.date <= monthEnd(lm0)),
      thisYear: sum((e) => e.date.startsWith(y)),
      avg12: sum((e) => e.date >= last12Start && e.date < tm0) / 12,
      byCategory: EXPENSE_CATEGORIES.map((c) => ({
        name: c,
        month: sum((e) => e.category === c && e.date >= tm0 && e.date <= monthEnd(today)),
        year: sum((e) => e.category === c && e.date.startsWith(y)),
        all: sum((e) => e.category === c),
      })),
    };
  }, [expenses, today]);

  async function remove(e: ExpenseWithCalc) {
    if (!confirm(`Delete "${e.name}" on ${niceDate(e.date)}? This cannot be undone.`)) return;
    const res = await fetch(`/api/expenses/${e.id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json().catch(() => null))?.error ?? "Could not delete");
    load();
  }

  const cur = settings?.reportingCurrency ?? "";

  return (
    <>
      <PageHeader
        title="Business Expenses"
        subtitle="Costs not tied to a single order, such as Kalodata, Shopify, software and staff. They reduce net profit, never individual orders."
        actions={
          <>
            <ImportCsv endpoint="/api/expenses/import" tabName="Business Expenses" onDone={load} />
            <button className="btn-primary" onClick={() => setEditing("new")} disabled={!settings}>+ Add expense</button>
          </>
        }
      />

      {error && <p className="mb-4 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card title={`Summary (${cur})`}>
          <MetricRow label="This month" value={money(summary.thisMonth)} strong />
          <MetricRow label="Last month" value={money(summary.lastMonth)} />
          <MetricRow label="This year" value={money(summary.thisYear)} />
          <MetricRow label="Average per month (last 12 full months)" value={money(summary.avg12)} />
          <MetricRow label="Paid" value={money(summary.paid)} />
          <MetricRow label="Pending (unpaid)" value={money(summary.pending)} />
          <MetricRow label="All time" value={money(summary.total)} />
        </Card>
        <Card title="Expenses by Category" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 text-right font-medium">This month</th>
                  <th className="px-4 py-2 text-right font-medium">This year</th>
                  <th className="px-4 py-2 text-right font-medium">All time</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCategory.map((c) => (
                  <tr key={c.name} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-1.5">{c.name}</td>
                    <td className="num px-4 py-1.5 text-right">{money(c.month)}</td>
                    <td className="num px-4 py-1.5 text-right">{money(c.year)}</td>
                    <td className="num px-4 py-1.5 text-right">{money(c.all)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-line bg-white p-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="eq">Search</label>
          <input id="eq" className="field" placeholder="Name or description" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ec">Category</label>
          <select id="ec" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ep">Payment status</label>
          <select id="ep" className="field" value={pay} onChange={(e) => setPay(e.target.value)}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading && !expenses.length ? (
        <Empty>Loading expenses...</Empty>
      ) : !expenses.length ? (
        <Empty>No business expenses yet. Add one, or import the Business Expenses tab from your Google Sheet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense</th>
                <th>Category</th>
                <th>Billing</th>
                <th className="text-right">Amount</th>
                <th>Payment</th>
                <th>Method</th>
                <th className="calc text-right">Amount ({cur})</th>
                <th className="calc"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>{niceDate(e.date)}</td>
                  <td className="max-w-64 truncate" title={e.description || e.name}>
                    {e.name}
                    {e.description && <span className="block truncate text-xs text-muted">{e.description}</span>}
                  </td>
                  <td>{e.category}</td>
                  <td>{e.billingType}</td>
                  <td className="num text-right">{money(e.amount)} <span className="text-xs text-muted">{e.currency}</span></td>
                  <td><Badge>{e.paymentStatus}</Badge></td>
                  <td>{e.paymentMethod}</td>
                  <td className="num text-right font-semibold">{money(e.amountReporting)}</td>
                  <td className="text-right">
                    <button className="mr-2 text-xs font-medium text-accent hover:underline" onClick={() => setEditing(e)}>Edit</button>
                    <button className="text-xs font-medium text-neg hover:underline" onClick={() => remove(e)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas font-semibold">
                <td colSpan={7} className="px-3 py-2.5">{shown.length} of {expenses.length} expenses</td>
                <td className="num px-3 text-right">{money(shown.reduce((a, e) => a + e.amountReporting, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && settings && (
        <Modal title={editing === "new" ? "Add business expense" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ExpenseForm
            expense={editing === "new" ? null : editing}
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
