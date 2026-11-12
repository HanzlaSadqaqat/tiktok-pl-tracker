"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ACCESS_LABELS, CLIENT_ACCESS, MIN_PASSWORD_LENGTH, ROLES, ROLE_LABELS, type ClientAccess, type Role } from "@/lib/constants";
import type { Client, MembershipRef, PublicUser } from "@/lib/types";
import { send } from "./ClientsManager";
import { Modal } from "./Modal";
import { Credentials, generatePassword } from "./people";
import { Empty, PageHeader } from "./ui";

const ROLE_HELP: Record<Role, string> = {
  admin: "The agency. Sees and manages every client, client settings and all users.",
  member: "A team member or a client. Sees only the clients ticked below, with edit or view-only access on each.",
};

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-navy text-white",
  member: "bg-accent-soft text-accent",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

export function UsersClient({ meId, clients }: { meId: string; clients: Client[] }) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PublicUser | "new" | null>(null);
  const [resetting, setResetting] = useState<PublicUser | null>(null);
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers((await send("/api/users", "GET")).users);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(u: PublicUser) {
    const verb = u.active ? "Deactivate" : "Reactivate";
    if (!confirm(`${verb} ${u.name}?${u.active ? " They will be signed out and unable to sign in." : ""}`)) return;
    try {
      await send(`/api/users/${u.id}`, "PUT", { active: !u.active });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(u: PublicUser) {
    if (!confirm(`Delete the account for ${u.name} (${u.email})? This cannot be undone. Orders and expenses they entered stay.`)) return;
    try {
      await send(`/api/users/${u.id}`, "DELETE");
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Only the people you add here can sign in. There is no public sign-up."
        actions={<button className="btn-primary" onClick={() => setEditing("new")}>+ Add user</button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {ROLES.map((r) => (
          <div key={r} className="rounded-lg border border-line bg-white p-3">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[r]}`}>{ROLE_LABELS[r]}</span>
            <p className="mt-2 text-xs text-muted">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}

      {loading && !users.length ? (
        <Empty>Loading users...</Empty>
      ) : !users.length ? (
        <Empty>No users yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Clients</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === meId;
                return (
                  <tr key={u.id} className={u.active ? "" : "text-muted"}>
                    <td className="font-medium text-navy">
                      {u.name}
                      {self && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td className="max-w-80 text-sm">
                      {u.role === "admin" ? (
                        <span className="text-muted">All clients</span>
                      ) : !u.memberships.length ? (
                        <span className="text-warn">No clients</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {u.memberships.map((m) => {
                            const c = clientName.get(m.clientId);
                            return (
                              <li key={m.clientId} className="truncate">
                                {c?.name ?? "Unknown client"}
                                <span className="text-xs text-muted"> · {ACCESS_LABELS[m.access]}{c?.status === "Archived" ? " · archived" : ""}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"}`}>
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm">{when(u.lastLoginAt)}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="mr-3 text-xs font-medium text-accent hover:underline" onClick={() => setEditing(u)}>Edit</button>
                      <button className="mr-3 text-xs font-medium text-accent hover:underline" onClick={() => setResetting(u)}>
                        {self ? "Change password" : "Reset password"}
                      </button>
                      {!self && (
                        <>
                          <button className="mr-3 text-xs font-medium text-warn hover:underline" onClick={() => toggleActive(u)}>
                            {u.active ? "Deactivate" : "Reactivate"}
                          </button>
                          <button className="text-xs font-medium text-neg hover:underline" onClick={() => remove(u)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add user" : `Edit ${editing.name}`} onClose={() => setEditing(null)} wide>
          <UserForm
            user={editing === "new" ? null : editing}
            self={editing !== "new" && editing.id === meId}
            clients={clients}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        </Modal>
      )}

      {resetting && (
        <Modal title={`New password for ${resetting.name}`} onClose={() => setResetting(null)}>
          {resetting.id === meId ? (
            <p className="text-sm">
              To change your own password, go to <a href="/account" className="font-medium text-accent hover:underline">My account</a>. It asks for your current password first.
            </p>
          ) : (
            <ResetPasswordForm user={resetting} onDone={() => setResetting(null)} />
          )}
        </Modal>
      )}
    </>
  );
}

/** Tick clients and choose edit / view on each. */
function MembershipPicker({ clients, value, onChange }: { clients: Client[]; value: MembershipRef[]; onChange: (v: MembershipRef[]) => void }) {
  const [q, setQ] = useState("");
  const byId = new Map(value.map((m) => [m.clientId, m.access]));
  const shown = clients.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, { clientId: id, access: "view" }] : value.filter((m) => m.clientId !== id));
  const setAccess = (id: string, access: ClientAccess) => onChange(value.map((m) => (m.clientId === id ? { ...m, access } : m)));

  if (!clients.length) return <p className="text-sm text-muted">No clients exist yet. Create one on the Clients page first.</p>;
  return (
    <div className="rounded-md border border-line">
      {clients.length > 6 && (
        <input className="w-full border-b border-line px-3 py-2 text-sm outline-none" placeholder="Search clients..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
      )}
      <ul className="max-h-64 overflow-y-auto">
        {shown.map((c) => {
          const access = byId.get(c.id);
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line/70 px-3 py-2 last:border-0">
              <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={!!access} onChange={(e) => toggle(c.id, e.target.checked)} />
                <span className="truncate">{c.name}</span>
                {c.status === "Archived" && <span className="text-xs text-muted">(archived)</span>}
              </label>
              {access && (
                <select className="field w-auto py-1 text-sm" value={access} onChange={(e) => setAccess(c.id, e.target.value as ClientAccess)} aria-label={`Access to ${c.name}`}>
                  {CLIENT_ACCESS.map((a) => <option key={a} value={a}>{ACCESS_LABELS[a]}</option>)}
                </select>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UserForm({ user, self, clients, onSaved }: { user: PublicUser | null; self: boolean; clients: Client[]; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "member");
  const [memberships, setMemberships] = useState<MembershipRef[]>(user?.memberships ?? []);
  const [password, setPassword] = useState(() => (user ? "" : generatePassword()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ms = role === "member" ? memberships : [];
      if (user) {
        await send(`/api/users/${user.id}`, "PUT", self ? { name, email } : { name, email, role, memberships: ms });
        onSaved();
      } else {
        await send("/api/users", "POST", { name, email, role, password, memberships: ms });
        setCreated({ email, password });
      }
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
        <button className="btn-primary w-full" onClick={onSaved}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="u-name">Name</label>
          <input id="u-name" className="field" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="u-email">Email</label>
          <input id="u-email" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <fieldset disabled={self}>
          <legend className="label">Role</legend>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <label key={r} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${role === r ? "border-accent bg-accent-soft/50" : "border-line"} ${self ? "cursor-not-allowed opacity-60" : ""}`}>
                <input type="radio" name="role" className="mt-0.5" checked={role === r} onChange={() => setRole(r)} />
                <span>
                  <span className="block text-sm font-medium text-navy">{ROLE_LABELS[r]}</span>
                  <span className="block text-xs text-muted">{ROLE_HELP[r]}</span>
                </span>
              </label>
            ))}
          </div>
          {self && <p className="mt-2 text-xs text-muted">You cannot change your own role.</p>}
        </fieldset>
        {!user && (
          <div>
            <label className="label" htmlFor="u-pw">Temporary password</label>
            <div className="flex gap-2">
              <input id="u-pw" className="field font-mono" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn-secondary shrink-0" onClick={() => setPassword(generatePassword())}>New</button>
            </div>
            <p className="mt-1 text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters. They can change it under My account after signing in.</p>
          </div>
        )}
      </div>
      <div>
        <p className="label">Client access</p>
        {role === "admin" ? (
          <p className="rounded-md bg-canvas px-3 py-2 text-sm text-muted">Agency admins can open every client.</p>
        ) : (
          <>
            <MembershipPicker clients={clients} value={memberships} onChange={setMemberships} />
            <p className="mt-1 text-xs text-muted">Changes take effect on their next click. Archived clients stay hidden from members.</p>
          </>
        )}
      </div>
      <div className="md:col-span-2">
        {error && <p className="mb-3 rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : user ? "Save changes" : "Create user"}</button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: PublicUser; onDone: () => void }) {
  const [password, setPassword] = useState(generatePassword);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send(`/api/users/${user.id}`, "PUT", { password });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm">Password changed. {user.name} has been signed out on every device. Send them the new details privately.</p>
        <Credentials email={user.email} password={password} />
        <button className="btn-primary w-full" onClick={onDone}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">Use this when someone forgets their password. They will be signed out everywhere.</p>
      <div>
        <label className="label" htmlFor="r-pw">New password</label>
        <div className="flex gap-2">
          <input id="r-pw" className="field font-mono" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="btn-secondary shrink-0" onClick={() => setPassword(generatePassword())}>New</button>
        </div>
      </div>
      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : "Set new password"}</button>
    </form>
  );
}
