"use client";

import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirmNext) return setMsg({ ok: false, text: "The new passwords do not match" });
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: (await res.json().catch(() => null))?.error ?? "Could not change password" });
    setCurrent("");
    setNext("");
    setConfirmNext("");
    setMsg({ ok: true, text: "Password changed. You have been signed out on your other devices." });
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <div>
        <label className="label" htmlFor="cur-pw">Current password</label>
        <input id="cur-pw" type="password" autoComplete="current-password" required className="field" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="new-pw">New password</label>
        <input id="new-pw" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} className="field" value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="mt-1 text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <div>
        <label className="label" htmlFor="new-pw2">Repeat new password</label>
        <input id="new-pw2" type="password" autoComplete="new-password" required className="field" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} />
      </div>
      {msg && <p className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"}`}>{msg.text}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : "Change password"}</button>
    </form>
  );
}
