"use client";

import { useCallback, useEffect, useState } from "react";
import { ACCESS_LABELS, CLIENT_ACCESS, MIN_PASSWORD_LENGTH, type ClientAccess } from "@/lib/constants";
import type { ClientPerson, PublicUser } from "@/lib/types";
import { send } from "./ClientsManager";
import { Modal } from "./Modal";
import { Credentials, generatePassword } from "./people";
import { Card } from "./ui";

const ACCESS_HELP: Record<ClientAccess, string> = {
  edit: "Can add, edit, delete and import this client's orders and business expenses.",
  view: "Can see this client's dashboard and reports. Cannot change anything. Usually the client themselves.",
};

/** Who can access one client. Agency admins are not listed: they can access every client. */
export function ClientPeople({ clientId, clientName }: { clientId: string; clientName: string }) {
  const api = `/api/clients/${clientId}/people`;
  const [people, setPeople] = useState<ClientPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setPeople((await send(api, "GET")).people);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function change(p: ClientPerson, access: ClientAccess) {
    try {
      setPeople((await send(`${api}/${p.userId}`, "PUT", { access })).people);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(p: ClientPerson) {
    if (!confirm(`Remove ${p.name}'s access to ${clientName}? It takes effect on their next click.`)) return;
    try {
      setPeople((await send(`${api}/${p.userId}`, "DELETE")).people);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="mt-6">
      <Card title={`People with access to ${clientName}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-xs text-muted">Agency admins can always open every client and are not listed here.</p>
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add person</button>
        </div>
        {error && <p className="m-4 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
        {people === null ? (
          <p className="px-4 py-3 text-sm text-muted">Loading...</p>
        ) : !people.length ? (
          <p className="px-4 py-3 text-sm text-muted">Nobody except agency admins can see this client yet.</p>
        ) : (
          <ul>
            {people.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-2.5 last:border-0">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-navy">
                    {p.name}
                    {!p.active && <span className="ml-2 rounded-full bg-neg-soft px-2 py-0.5 text-xs font-medium text-neg">Deactivated</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{p.email}</span>
                </span>
                <span className="flex items-center gap-3">
                  <select className="field w-auto py-1 text-sm" value={p.access} onChange={(e) => change(p, e.target.value as ClientAccess)} aria-label={`Access for ${p.name}`}>
                    {CLIENT_ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABELS[a]}</option>)}
                  </select>
                  <button className="text-xs font-medium text-neg hover:underline" onClick={() => remove(p)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {adding && (
        <Modal title={`Add a person to ${clientName}`} onClose={() => setAdding(false)}>
          <AddPerson
            api={api}
            existing={people ?? []}
            onAdded={(list) => setPeople(list)}
            onClose={() => setAdding(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function AddPerson({ api, existing, onAdded, onClose }: { api: string; existing: ClientPerson[]; onAdded: (p: ClientPerson[]) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword);
  const [access, setAccess] = useState<ClientAccess>("view");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    send("/api/users", "GET")
      .then((d) => {
        const taken = new Set(existing.map((p) => p.userId));
        const options = (d.users as PublicUser[]).filter((u) => u.role === "member" && !taken.has(u.id));
        setUsers(options);
        if (!options.length) setMode("new");
      })
      .catch((err: Error) => setError(err.message));
  }, [existing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = mode === "existing" ? { userId, access } : { name, email, password, access };
      onAdded((await send(api, "POST", body)).people);
      if (mode === "new") setCreated({ email, password });
      else onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p className="text-sm">The account is ready. Send these sign-in details to {name} privately. The password is not shown again.</p>
        <Credentials email={created.email} password={created.password} />
        <button className="btn-primary w-full" onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-line bg-canvas p-1 text-sm">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 ${mode === m ? "bg-white font-medium text-navy shadow-sm" : "text-muted"}`}
            onClick={() => setMode(m)}
          >
            {m === "existing" ? "Existing user" : "Invite someone new"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div>
          <label className="label" htmlFor="p-user">User</label>
          {users === null ? (
            <p className="text-sm text-muted">Loading users...</p>
          ) : users.length ? (
            <select id="p-user" className="field" required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Choose a user...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email}){u.active ? "" : " - deactivated"}</option>)}
            </select>
          ) : (
            <p className="text-sm text-muted">Every member already has access. Invite someone new instead.</p>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="p-name">Name</label>
            <input id="p-name" className="field" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-email">Email</label>
            <input id="p-email" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="p-pw">Temporary password</label>
            <div className="flex gap-2">
              <input id="p-pw" className="field font-mono" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn-secondary shrink-0" onClick={() => setPassword(generatePassword())}>New</button>
            </div>
          </div>
        </>
      )}

      <fieldset>
        <legend className="label">Access to this client</legend>
        <div className="space-y-2">
          {CLIENT_ACCESS.map((a) => (
            <label key={a} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${access === a ? "border-accent bg-accent-soft/50" : "border-line"}`}>
              <input type="radio" name="access" className="mt-0.5" checked={access === a} onChange={() => setAccess(a)} />
              <span>
                <span className="block text-sm font-medium text-navy">{ACCESS_LABELS[a]}</span>
                <span className="block text-xs text-muted">{ACCESS_HELP[a]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || (mode === "existing" && !userId)}>
        {busy ? "Saving..." : mode === "existing" ? "Give access" : "Create account and give access"}
      </button>
    </form>
  );
}
