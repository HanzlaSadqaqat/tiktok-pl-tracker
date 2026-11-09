"use client";

import { useState } from "react";
import { Modal } from "./Modal";

export function ImportCsv({ endpoint, tabName, onDone }: { endpoint: string; tabName: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: await file.text() }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(data?.error ?? "Import failed");
    setResult(data);
    onDone();
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>Import CSV</button>
      {open && (
        <Modal title={`Import from the ${tabName} tab`} onClose={() => { setOpen(false); setResult(null); setError(null); }}>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink/80">
            <li>Open your Google Sheet and go to the <strong>{tabName}</strong> tab.</li>
            <li>Choose <strong>File → Download → Comma-separated values (.csv)</strong>.</li>
            <li>Pick that file below. Rows already in the app are skipped, and example rows are ignored.</li>
          </ol>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:text-white"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {busy && <p className="mt-3 text-sm text-muted">Importing...</p>}
          {error && <p className="mt-3 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
          {result && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="rounded-md bg-pos-soft px-3 py-2 text-pos">
                Imported {result.inserted} row{result.inserted === 1 ? "" : "s"}. Skipped {result.skipped} already in the app.
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 list-disc overflow-y-auto rounded-md bg-warn-soft px-6 py-2 text-warn">
                  {result.errors.map((er, i) => <li key={i}>{er}</li>)}
                </ul>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
