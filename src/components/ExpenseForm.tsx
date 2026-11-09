"use client";

import { useState } from "react";
import { BILLING_TYPES, CURRENCIES, EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import type { AppSettings, Expense, ExpenseInput } from "@/lib/types";

type FormState = Omit<ExpenseInput, "amount"> & { amount: string };

export function ExpenseForm({
  expense,
  settings,
  today,
  onSaved,
  onCancel,
}: {
  expense: Expense | null;
  settings: AppSettings;
  today: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>({
    date: expense?.date ?? today,
    name: expense?.name ?? "",
    category: expense?.category ?? "Software Subscriptions",
    description: expense?.description ?? "",
    billingType: expense?.billingType ?? "Monthly",
    amount: expense ? String(expense.amount) : "",
    currency: expense?.currency ?? settings.reportingCurrency,
    paymentStatus: expense?.paymentStatus ?? "Paid",
    paymentMethod: expense?.paymentMethod ?? "Credit Card",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const currencies = [...new Set([settings.reportingCurrency, ...CURRENCIES, ...Object.keys(settings.rates)])];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(expense ? `/api/expenses/${expense.id}` : "/api/expenses", {
      method: expense ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, amount: Number(f.amount) || 0 }),
    });
    setSaving(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Could not save the expense");
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-md bg-accent-soft px-3 py-2 text-xs text-navy">
        Add each charge on the date it was billed. A monthly subscription gets one row per month, so it is never counted twice.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">Expense date</label>
          <input id="date" type="date" required className="field" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="name">Expense name</label>
          <input id="name" required className="field" placeholder="Kalodata Subscription" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" className="field" value={f.category} onChange={(e) => set("category", e.target.value as FormState["category"])}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="billingType">Billing type</label>
          <select id="billingType" className="field" value={f.billingType} onChange={(e) => set("billingType", e.target.value as FormState["billingType"])}>
            {BILLING_TYPES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" type="number" step="any" inputMode="decimal" required className="field num" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <select id="currency" className="field" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="paymentStatus">Payment status</label>
          <select id="paymentStatus" className="field" value={f.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value as FormState["paymentStatus"])}>
            {PAYMENT_STATUSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="paymentMethod">Payment method</label>
          <select id="paymentMethod" className="field" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as FormState["paymentMethod"])}>
            {PAYMENT_METHODS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <input id="description" className="field" value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
      </div>
      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : expense ? "Save changes" : "Add expense"}</button>
      </div>
    </form>
  );
}
