import { NextResponse } from "next/server";
import { HttpError, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { CURRENCIES } from "@/lib/constants";
import { getSettings, saveSettings } from "@/lib/repo";

/** Loads current exchange rates for the listed currencies into Settings. Manual rates are replaced. */
export const POST = handle(async () => {
  await requireUser("admin");
  const settings = await getSettings();
  const base = settings.reportingCurrency;
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, { cache: "no-store" });
  if (!res.ok) throw new HttpError(502, "Could not reach the exchange rate service");
  const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  if (data.result !== "success" || !data.rates) throw new HttpError(502, "The exchange rate service returned no rates");

  const wanted = new Set<string>([...CURRENCIES, ...Object.keys(settings.rates)]);
  const rates: Record<string, number> = {};
  for (const c of wanted) {
    const perBase = data.rates[c];
    if (c !== base && perBase && perBase > 0) rates[c] = 1 / perBase;
  }
  const saved = await saveSettings({ rates, ratesUpdatedAt: data.time_last_update_utc ?? new Date().toUTCString() });
  return NextResponse.json({ settings: saved });
});
