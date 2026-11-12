"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CURRENCIES } from "@/lib/constants";
import type { Client } from "@/lib/types";
import { Modal } from "./Modal";
import { Empty, PageHeader } from "./ui";

export async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
  return data;
}

/** Same rule as the server's slugify(), for a live preview of the web address. */
const slugPreview = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function ClientsManager({ initial }: { initial: Client[] }) {
  const router = useRouter();
  const [clients, setClients] = useState(initial);
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  async function reload() {
    setClients((await send("/api/clients", "GET")).clients);
    router.refresh(); // update the sidebar's client list
  }

  async function setStatus(c: Client, status: Client["status"]) {
    const msg =
      status === "Archived"
        ? `Archive ${c.name}? Members lose access straight away and it disappears from the overview. You can unarchive it later.`
        : `Unarchive ${c.name}? Its members get their access back.`;
    if (!confirm(msg)) return;
    try {
      await send(`/api/clients/${c.id}`, "PUT", { status });
      await reload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const shown = clients.filter((c) => showArchived || c.status === "Active");
  const archivedCount = clients.filter((c) => c.status === "Archived").length;

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Every client has its own orders, expenses, settings and reports. Nothing is shared between clients."
        actions={<button className="btn-primary" onClick={() => setEditing("new")}>+ New client</button>}
      />
      {archivedCount > 0 && (
        <label className="mb-3 inline-flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show {archivedCount} archived client{archivedCount === 1 ? "" : "s"}
        </label>
      )}
      {!shown.length ? (
        <Empty>No clients yet. Create one to start tracking its orders.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Web address</th>
                <th>TikTok Shop</th>
                <th>Marketplace</th>
                <th>Contact</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className={c.status === "Archived" ? "text-muted" : ""}>
                  <td><Link href={`/c/${c.slug}`} className="font-medium text-accent hover:underline">{c.name}</Link></td>
                  <td className="font-mono text-xs">/c/{c.slug}</td>
                  <td>{c.shopName || <span className="text-muted">-</span>}</td>
                  <td>{c.marketplace || <span className="text-muted">-</span>}</td>
                  <td className="text-sm">
                    {c.contactName || c.contactEmail ? (
                      <>
                        {c.contactName}
                        {c.contactEmail && <span className="block text-xs text-muted">{c.contactEmail}</span>}
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "Active" ? "bg-pos-soft text-pos" : "bg-canvas text-muted"}`}>{c.status}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="mr-3 text-xs font-medium text-accent hover:underline" onClick={() => setEditing(c)}>Edit</button>
                    <Link href={`/c/${c.slug}/settings`} className="mr-3 text-xs font-medium text-accent hover:underline">Settings &amp; people</Link>
                    {c.status === "Active" ? (
                      <button className="text-xs font-medium text-warn hover:underline" onClick={() => setStatus(c, "Archived")}>Archive</button>
                    ) : (
                      <>
                        <button className="mr-3 text-xs font-medium text-accent hover:underline" onClick={() => setStatus(c, "Active")}>Unarchive</button>
                        <button className="text-xs font-medium text-neg hover:underline" onClick={() => setDeleting(c)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "New client" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ClientForm
            client={editing === "new" ? null : editing}
            onSaved={async () => {
              setEditing(null);
              await reload();
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title={`Delete ${deleting.name} permanently`} onClose={() => setDeleting(null)}>
          <DeleteClient
            client={deleting}
            onDone={async () => {
              setDeleting(null);
              await reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function ClientForm({ client, onSaved }: { client: Client | null; onSaved: () => void }) {
  const [f, setF] = useState({
    name: client?.name ?? "",
    slug: client?.slug ?? "",
    shopName: client?.shopName ?? "",
    marketplace: client?.marketplace ?? "",
    contactName: client?.contactName ?? "",
    contactEmail: client?.contactEmail ?? "",
    notes: client?.notes ?? "",
    reportingCurrency: "USD",
  });
  const [slugTouched, setSlugTouched] = useState(!!client);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const slug = slugTouched ? f.slug : slugPreview(f.name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { reportingCurrency, ...rest } = f;
      const body = { ...rest, slug };
      if (client) await send(`/api/clients/${client.id}`, "PUT", body);
      else await send("/api/clients", "POST", { ...body, reportingCurrency });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="c-name">Client name</label>
        <input id="c-name" className="field" required maxLength={100} autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ali's Home Store" />
      </div>
      <div>
        <label className="label" htmlFor="c-slug">Web address</label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted">/c/</span>
          <input
            id="c-slug"
            className="field font-mono"
            maxLength={60}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
          />
        </div>
        {client && slug !== client.slug && <p className="mt-1 text-xs text-warn">Old links to /c/{client.slug} will stop working.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-shop">TikTok Shop name</label>
          <input id="c-shop" className="field" maxLength={100} value={f.shopName} onChange={(e) => set("shopName", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="c-mkt">Marketplace</label>
          <input id="c-mkt" className="field" maxLength={40} value={f.marketplace} onChange={(e) => set("marketplace", e.target.value)} placeholder="US, UK, MY, PH..." />
        </div>
        <div>
          <label className="label" htmlFor="c-cn">Contact name</label>
          <input id="c-cn" className="field" maxLength={80} value={f.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="c-ce">Contact email</label>
          <input id="c-ce" type="email" className="field" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </div>
      </div>
      {!client && (
        <div>
          <label className="label" htmlFor="c-cur">Reporting currency</label>
          <select id="c-cur" className="field" value={f.reportingCurrency} onChange={(e) => set("reportingCurrency", e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">All of this client&apos;s reports are shown in this currency. You can change it and load exchange rates in the client&apos;s Settings.</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="c-notes">Notes</label>
        <textarea id="c-notes" className="field min-h-20" maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : client ? "Save changes" : "Create client"}</button>
    </form>
  );
}

function DeleteClient({ client, onDone }: { client: Client; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === client.name.trim().toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send(`/api/clients/${client.id}`, "DELETE", { confirmName: typed });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">
        This permanently deletes <strong>{client.name}</strong> with all its orders, business expenses, settings and people&apos;s access. It cannot be undone.
      </p>
      <div>
        <label className="label" htmlFor="del-name">Type <strong>{client.name}</strong> to confirm</label>
        <input id="del-name" className="field" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      <button className="btn-danger w-full" disabled={!matches || busy}>{busy ? "Deleting..." : "Delete permanently"}</button>
    </form>
  );
}
