"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { PERIODS, type Period } from "@/lib/constants";

export function PeriodFilter({ period, start, end }: { period: Period; start: string; end: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(period === "Custom Range" ? start : "");
  const [to, setTo] = useState(period === "Custom Range" ? end : "");

  function go(next: Period, f = from, t = to) {
    const sp = new URLSearchParams(params.toString());
    sp.set("period", next);
    if (next === "Custom Range") {
      if (f) sp.set("start", f); else sp.delete("start");
      if (t) sp.set("end", t); else sp.delete("end");
    } else {
      sp.delete("start");
      sp.delete("end");
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
      <div>
        <label className="label" htmlFor="period">Period</label>
        <select id="period" className="field min-w-40" value={period} onChange={(e) => go(e.target.value as Period)}>
          {PERIODS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      {period === "Custom Range" && (
        <>
          <div>
            <label className="label" htmlFor="from">From</label>
            <input id="from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input id="to" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => go("Custom Range")}>Apply</button>
        </>
      )}
      <p className="pb-2 text-xs text-muted">{pending ? "Updating..." : null}</p>
    </div>
  );
}
