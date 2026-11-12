"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ACCESS_LABELS, LAST_CLIENT_COOKIE, ROLE_LABELS } from "@/lib/constants";
import type { ClientWithAccess, SessionUser } from "@/lib/types";

const CLIENT_LINKS = [
  { sub: "", label: "Dashboard" },
  { sub: "/orders", label: "Orders" },
  { sub: "/expenses", label: "Business Expenses" },
  { sub: "/reports", label: "Monthly Reports" },
  { sub: "/products", label: "Product Analysis" },
  { sub: "/settings", label: "Settings", adminOnly: true },
];

const AGENCY_LINKS = [
  { href: "/clients", label: "All clients", exact: true },
  { href: "/clients/manage", label: "Clients" },
  { href: "/users", label: "Users" },
];

/** "/c/my-shop/orders" -> { slug: "my-shop", sub: "/orders" } */
function parseClientPath(pathname: string) {
  const m = pathname.match(/^\/c\/([^/]+)(\/.*)?$/);
  return m ? { slug: decodeURIComponent(m[1]), sub: m[2] ?? "" } : null;
}

export function Nav({ user, clients, lastClientId }: { user: SessionUser | null; clients: ClientWithAccess[]; lastClientId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const here = parseClientPath(pathname);
  const isAdmin = user?.role === "admin";

  // The client whose links are shown: the one in the URL, else the last one used, else the only one.
  const active = clients.filter((c) => c.status === "Active");
  const current =
    (here && clients.find((c) => c.slug === here.slug)) ||
    clients.find((c) => c.id === lastClientId && c.status === "Active") ||
    (active.length === 1 ? active[0] : null);

  // Remember the client being viewed, so it opens again next time.
  const viewingId = here && current && current.slug === here.slug ? current.id : null;
  useEffect(() => {
    if (viewingId) document.cookie = `${LAST_CLIENT_COOKIE}=${viewingId}; path=/; max-age=${365 * 86400}; samesite=lax`;
  }, [viewingId]);

  if (pathname === "/login" || !user) return null;

  const isActive = (href: string, exact = false) => (exact || href === "/" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const linkClass = (on: boolean) =>
    `block rounded-md px-3 py-2 text-sm transition ${on ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`;

  return (
    <aside className="bg-navy text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 md:py-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white/10">
            <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
              <path d="M6 22l6-7 5 3.5L26 9" fill="none" stroke="#5fd38d" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">TikTok Shop</span>
            <span className="block text-xs text-white/60">Profit &amp; Loss</span>
          </span>
        </Link>
        <button
          className="rounded-md p-2 text-white/80 hover:bg-white/10 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <nav className={`${open ? "block" : "hidden"} px-3 pb-4 md:block`}>
        {clients.length > 1 ? (
          <ClientSwitcher clients={clients} current={current} sub={here?.sub ?? ""} isAdmin={isAdmin} onPick={() => setOpen(false)} />
        ) : current ? (
          <div className="mb-3 rounded-md bg-white/5 px-3 py-2">
            <span className="block text-[11px] uppercase tracking-wide text-white/45">Client</span>
            <span className="block truncate text-sm font-medium">{current.name}</span>
          </div>
        ) : null}

        {current && (
          <ul className="space-y-0.5">
            {CLIENT_LINKS.filter((l) => !l.adminOnly || isAdmin).map((l) => {
              const href = `/c/${current.slug}${l.sub}`;
              return (
                <li key={l.sub}>
                  <Link href={href} onClick={() => setOpen(false)} className={linkClass(l.sub === "" ? pathname === href : isActive(href))}>
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!current && !isAdmin && <p className="px-3 py-2 text-sm text-white/60">No client access yet.</p>}

        {isAdmin && (
          <>
            <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">Agency</p>
            <ul className="space-y-0.5">
              {AGENCY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className={linkClass(isActive(l.href, l.exact))}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 border-t border-white/10 pt-4">
          <Link href="/account" onClick={() => setOpen(false)} className={`block rounded-md px-3 py-2 transition ${isActive("/account") ? "bg-white/15" : "hover:bg-white/10"}`}>
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/55">
              {ROLE_LABELS[user.role]}
              {!isAdmin && current && current.access !== "admin" && ` · ${ACCESS_LABELS[current.access]}`} · My account
            </span>
          </Link>
          <button onClick={signOut} className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white">
            Sign out
          </button>
        </div>
      </nav>
    </aside>
  );
}

function ClientSwitcher({
  clients,
  current,
  sub,
  isAdmin,
  onPick,
}: {
  clients: ClientWithAccess[];
  current: ClientWithAccess | null;
  sub: string;
  isAdmin: boolean;
  onPick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return clients.filter((c) => !n || [c.name, c.shopName, c.marketplace, c.slug].some((v) => v.toLowerCase().includes(n)));
  }, [clients, q]);

  // Keep the same page when switching (Settings only exists for admins).
  const keepSub = sub === "/settings" && !isAdmin ? "" : sub.split("?")[0];

  return (
    <div ref={box} className="relative mb-3">
      <button
        className="flex w-full items-center justify-between gap-2 rounded-md bg-white/10 px-3 py-2 text-left hover:bg-white/15"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-wide text-white/45">Client</span>
          <span className="block truncate text-sm font-medium">{current?.name ?? "Choose a client"}</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-md bg-white text-ink shadow-xl">
          <input
            autoFocus
            className="w-full border-b border-line px-3 py-2 text-sm outline-none"
            placeholder="Search clients..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search clients"
          />
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/c/${c.slug}${keepSub}`}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    onPick();
                  }}
                  className={`block px-3 py-2 text-sm hover:bg-canvas ${c.id === current?.id ? "bg-accent-soft font-medium text-accent" : ""}`}
                >
                  <span className="block truncate">{c.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[c.shopName, c.marketplace, c.status === "Archived" ? "Archived" : null, c.access === "admin" ? null : ACCESS_LABELS[c.access]]
                      .filter(Boolean)
                      .join(" · ") || c.slug}
                  </span>
                </Link>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-2 text-sm text-muted">No matching clients</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
