"use client";

import { useMemo, useState } from "react";
import { computeOrder } from "@/lib/calc";
import { CURRENCIES, ORDER_STATUSES, PAYOUT_STATUSES, TAX_TREATMENTS } from "@/lib/constants";
import { money, pct } from "@/lib/format";
import type { AppSettings, Order, OrderInput } from "@/lib/types";

type NumKey =
  | "quantity" | "salePrice" | "buyPrice" | "packaging" | "shipping" | "otherCosts" | "referralFee"
  | "transactionFee" | "fulfillmentFee" | "affiliateCommission" | "adCost" | "otherPlatformFees" | "salesTax" | "refund";

const NUM_FIELDS: { key: NumKey; label: string; group: string }[] = [
  { key: "quantity", label: "Quantity", group: "Units & price" },
  { key: "salePrice", label: "Sale price / unit", group: "Units & price" },
  { key: "buyPrice", label: "Buying price / unit", group: "Units & price" },
  { key: "packaging", label: "Packaging cost", group: "Order costs" },
  { key: "shipping", label: "Shipping cost", group: "Order costs" },
  { key: "otherCosts", label: "Other order costs", group: "Order costs" },
  { key: "referralFee", label: "Referral / commission fee", group: "TikTok fees, ads & tax" },
  { key: "transactionFee", label: "Transaction fee", group: "TikTok fees, ads & tax" },
  { key: "fulfillmentFee", label: "Fulfillment fee", group: "TikTok fees, ads & tax" },
  { key: "affiliateCommission", label: "Affiliate commission", group: "TikTok fees, ads & tax" },
  { key: "adCost", label: "Advertising cost", group: "TikTok fees, ads & tax" },
  { key: "otherPlatformFees", label: "Other platform fees", group: "TikTok fees, ads & tax" },
  { key: "salesTax", label: "Sales tax / VAT", group: "TikTok fees, ads & tax" },
  { key: "refund", label: "Refund to buyer", group: "TikTok fees, ads & tax" },
];

type FormState = Omit<Order, "id" | NumKey | "taxTreatment"> & Record<NumKey, string> & { taxTreatment: string };

function toForm(o: Order | null, today: string, settings: AppSettings): FormState {
  const nums = Object.fromEntries(NUM_FIELDS.map((f) => [f.key, o ? String(o[f.key] || "") : f.key === "quantity" ? "1" : ""])) as Record<NumKey, string>;
  return {
    orderDate: o?.orderDate ?? today,
    orderId: o?.orderId ?? "",
    productName: o?.productName ?? "",
    sku: o?.sku ?? "",
    status: o?.status ?? "Pending",
    payoutStatus: o?.payoutStatus ?? "Awaiting payout",
    currency: o?.currency ?? settings.reportingCurrency,
    taxTreatment: o?.taxTreatment ?? "",
    notes: o?.notes ?? "",
    ...nums,
  };
}

function toPayload(f: FormState): OrderInput {
  const nums = Object.fromEntries(NUM_FIELDS.map((x) => [x.key, Number(f[x.key]) || 0])) as Record<NumKey, number>;
  return { ...f, ...nums, taxTreatment: (f.taxTreatment || null) as OrderInput["taxTreatment"] };
}

export function OrderForm({
  order,
  settings,
  today,
  onSaved,
  onCancel,
}: {
  order: Order | null;
  settings: AppSettings;
  today: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(() => toForm(order, today, settings));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const preview = useMemo(() => computeOrder({ id: "preview", ...toPayload(f) }, settings), [f, settings]);
  const currencies = [...new Set([settings.reportingCurrency, ...CURRENCIES, ...Object.keys(settings.rates)])];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(order ? `/api/orders/${order.id}` : "/api/orders", {
      method: order ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(f)),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Could not save the order");
      return;
    }
    onSaved();
  }

  const groups = [...new Set(NUM_FIELDS.map((x) => x.group))];

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">Order information</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="orderDate">Order date</label>
            <input id="orderDate" type="date" required className="field" value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="orderId">Order ID</label>
            <input id="orderId" required className="field" value={f.orderId} onChange={(e) => set("orderId", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="sku">Product SKU</label>
            <input id="sku" className="field" value={f.sku} onChange={(e) => set("sku", e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="productName">Product name</label>
            <input id="productName" required className="field" value={f.productName} onChange={(e) => set("productName", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="status">Order status</label>
            <select id="status" className="field" value={f.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="payoutStatus">Payout status</label>
            <select id="payoutStatus" className="field" value={f.payoutStatus} onChange={(e) => set("payoutStatus", e.target.value as FormState["payoutStatus"])}>
              {PAYOUT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" className="field" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              {currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {groups.map((g) => (
        <fieldset key={g}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy">{g}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NUM_FIELDS.filter((x) => x.group === g).map((x) => (
              <div key={x.key}>
                <label className="label" htmlFor={x.key}>{x.label}</label>
                <input
                  id={x.key}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={x.key === "quantity" ? 0 : undefined}
                  className="field num"
                  value={f[x.key]}
                  placeholder="0"
                  onChange={(e) => set(x.key, e.target.value)}
                />
              </div>
            ))}
            {g === "TikTok fees, ads & tax" && (
              <div>
                <label className="label" htmlFor="taxTreatment">Tax treatment</label>
                <select id="taxTreatment" className="field" value={f.taxTreatment} onChange={(e) => set("taxTreatment", e.target.value)}>
                  <option value="">Default ({settings.defaultTaxTreatment})</option>
                  {TAX_TREATMENTS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        </fieldset>
      ))}

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" rows={2} className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-canvas p-3 text-sm sm:grid-cols-4">
        <div><span className="block text-xs text-muted">Revenue</span><span className="num font-semibold">{money(preview.revenue)}</span></div>
        <div><span className="block text-xs text-muted">Order costs</span><span className="num font-semibold">{money(preview.totalExpenses)}</span></div>
        <div>
          <span className="block text-xs text-muted">Net profit</span>
          <span className={`num font-semibold ${preview.netProfit < 0 ? "text-neg" : "text-pos"}`}>{money(preview.netProfit)}</span>
        </div>
        <div><span className="block text-xs text-muted">Margin / ROI</span><span className="num font-semibold">{pct(preview.margin)} / {pct(preview.roi)}</span></div>
      </div>

      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : order ? "Save changes" : "Add order"}</button>
      </div>
    </form>
  );
}
