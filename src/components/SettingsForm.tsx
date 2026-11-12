"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, TAX_TREATMENTS, type TaxTreatment } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";
import { Card, PageHeader } from "./ui";

export function SettingsForm({ clientId, clientName }: { clientId: string; clientName: string }) {
  const api = `/api/clients/${clientId}/settings`;
  const [s, setS] = useState<AppSettings | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [newCode, setNewCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(next: AppSettings) {
    setS(next);
    setRates(Object.fromEntries(Object.entries(next.rates).map(([k, v]) => [k, String(Number(v.toPrecision(6)))])));
  }

  useEffect(() => {
    fetch(api, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        apply(d.settings);
      })
      .catch((e: Error) => setMsg({ ok: false, text: e.message || "Could not load settings" }));
  }, [api]);

  if (!s) return <PageHeader title="Settings" subtitle={msg?.text ?? "Loading..."} />;

  const codes = [...new Set([...CURRENCIES, ...Object.keys(rates)])].filter((c) => c !== s.reportingCurrency);

  async function save() {
    if (!s) return;
    setBusy(true);
    setMsg(null);
    const cleanRates = Object.fromEntries(
      Object.entries(rates)
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([k, v]) => k !== s.reportingCurrency && Number.isFinite(v) && v > 0),
    );
    const res = await fetch(api, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, rates: cleanRates }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d?.error ?? "Could not save" });
    apply(d.settings);
    setMsg({ ok: true, text: `Settings saved. All of ${clientName}'s reports now use these values.` });
  }

  async function refreshRates() {
    setBusy(true);
    setMsg(null);
    // Save the reporting currency first so rates are fetched against it.
    await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, rates: {} }) });
    const res = await fetch(`${api}/rates`, { method: "POST" });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d?.error ?? "Could not load rates" });
    apply(d.settings);
    setMsg({ ok: true, text: "Exchange rates updated." });
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={`${clientName}. These values apply to every order, expense and report of this client only.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="General">
          <div className="space-y-4 p-4">
            <div>
              <label className="label" htmlFor="rc">Reporting currency</label>
              <select id="rc" className="field" value={s.reportingCurrency} onChange={(e) => setS({ ...s, reportingCurrency: e.target.value })}>
                {[...new Set([s.reportingCurrency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">If you change this, refresh the exchange rates so every rate is against the new currency.</p>
            </div>
            <div>
              <label className="label" htmlFor="lm">Low-margin threshold (%)</label>
              <input
                id="lm"
                type="number"
                min={0}
                max={100}
                step="0.5"
                className="field num"
                value={Math.round(s.lowMarginThreshold * 1000) / 10}
                onChange={(e) => setS({ ...s, lowMarginThreshold: (Number(e.target.value) || 0) / 100 })}
              />
              <p className="mt-1 text-xs text-muted">Orders and products below this margin are flagged yellow.</p>
            </div>
            <div>
              <label className="label" htmlFor="tt">Default sales tax treatment</label>
              <select id="tt" className="field" value={s.defaultTaxTreatment} onChange={(e) => setS({ ...s, defaultTaxTreatment: e.target.value as TaxTreatment })}>
                {TAX_TREATMENTS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li><strong>On top of price:</strong> the buyer pays the tax and TikTok remits it. It is neither revenue nor cost.</li>
                <li><strong>Deducted from payout:</strong> the tax comes out of your proceeds, so it counts as a cost.</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card title={`Exchange rates (value of 1 unit in ${s.reportingCurrency})`}>
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">{s.ratesUpdatedAt ? `Last loaded: ${s.ratesUpdatedAt}` : "Rates have not been loaded yet."}</p>
              <button className="btn-secondary" onClick={refreshRates} disabled={busy}>Load current rates</button>
            </div>
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {codes.map((c) => (
                <div key={c}>
                  <label className="label" htmlFor={`r-${c}`}>{c}</label>
                  <input
                    id={`r-${c}`}
                    type="number"
                    step="any"
                    min={0}
                    className="field num"
                    placeholder="not set"
                    value={rates[c] ?? ""}
                    onChange={(e) => setRates({ ...rates, [c]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input className="field max-w-28 uppercase" maxLength={3} placeholder="JPY" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} aria-label="New currency code" />
              <button
                className="btn-secondary"
                onClick={() => {
                  if (/^[A-Z]{3}$/.test(newCode) && !(newCode in rates)) setRates({ ...rates, [newCode]: "" });
                  setNewCode("");
                }}
              >
                Add currency
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save settings"}</button>
        {msg && <p className={`text-sm ${msg.ok ? "text-pos" : "text-neg"}`}>{msg.text}</p>}
      </div>
    </>
  );
}
