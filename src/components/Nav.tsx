"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS, hasRole, type Role } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";

const LINKS: { href: string; label: string; role: Role }[] = [
  { href: "/", label: "Dashboard", role: "viewer" },
  { href: "/orders", label: "Orders", role: "viewer" },
  { href: "/expenses", label: "Business Expenses", role: "viewer" },
  { href: "/reports", label: "Monthly Reports", role: "viewer" },
  { href: "/products", label: "Product Analysis", role: "viewer" },
  { href: "/users", label: "Users", role: "admin" },
  { href: "/settings", label: "Settings", role: "admin" },
];

export function Nav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (pathname === "/login" || !user) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="bg-navy text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
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
        <ul className="space-y-0.5">
          {LINKS.filter((l) => hasRole(user.role, l.role)).map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  isActive(l.href) ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-white/10 pt-4">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className={`block rounded-md px-3 py-2 transition ${isActive("/account") ? "bg-white/15" : "hover:bg-white/10"}`}
          >
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/55">{ROLE_LABELS[user.role]}</span>
          </Link>
          <button onClick={signOut} className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white">
            Sign out
          </button>
        </div>
      </nav>
    </aside>
  );
}
