"use client";

import { useCallback, useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH, ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import type { PublicUser } from "@/lib/types";
import { Modal } from "./Modal";
import { Empty, PageHeader } from "./ui";

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including Settings and managing users.",
  editor: "Sees all pages. Can add, edit, delete and import orders and business expenses.",
  viewer: "Sees the dashboard, orders, expenses, reports and products. Cannot change anything.",
};

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-navy text-white",
  editor: "bg-accent-soft text-accent",
  viewer: "bg-canvas text-ink",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

/** A readable random password, e.g. "kite-Rv8q-maple-42". */
function generatePassword() {
  const words = ["amber", "cedar", "delta", "ember", "falcon", "harbor", "kite", "lotus", "maple", "nova", "orbit", "pixel", "river", "sable", "tiger", "zephyr"];
  const r = new Uint32Array(4);
  crypto.getRandomValues(r);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const mid = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => chars[n % chars.length]).join("");
  return `${words[r[0] % words.length]}-${mid}-${words[r[1] % words.length]}-${10 + (r[2] % 90)}`;
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
  return data;
}

export function UsersClient({ meId }: { meId: string }) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PublicUser | "new" | null>(null);
  const [resetting, setResetting] = useState<PublicUser | null>(null);

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
    if (!confirm(`Delete the account for ${u.name} (${u.email})? This cannot be undone. Their orders and expenses stay.`)) return;
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

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
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
                <th>Access</th>
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
        <Modal title={editing === "new" ? "Add user" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <UserForm
            user={editing === "new" ? null : editing}
            self={editing !== "new" && editing.id === meId}
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

function UserForm({ user, self, onSaved }: { user: PublicUser | null; self: boolean; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "viewer");
  const [password, setPassword] = useState(() => (user ? "" : generatePassword()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await send(`/api/users/${user.id}`, "PUT", self ? { name, email } : { name, email, role });
        onSaved();
      } else {
        await send("/api/users", "POST", { name, email, role, password });
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="u-name">Name</label>
        <input id="u-name" className="field" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="u-email">Email</label>
        <input id="u-email" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <fieldset disabled={self}>
        <legend className="label">Access</legend>
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
        {self && <p className="mt-2 text-xs text-muted">You cannot change your own access.</p>}
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
      {error && <p className="rounded-md bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : user ? "Save changes" : "Create user"}</button>
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

function Credentials({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Sign in at ${typeof window !== "undefined" ? window.location.origin : ""}/login\nEmail: ${email}\nPassword: ${password}`;
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <pre className="whitespace-pre-wrap break-all font-mono text-xs text-ink">{text}</pre>
      <button
        type="button"
        className="btn-secondary mt-3"
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
