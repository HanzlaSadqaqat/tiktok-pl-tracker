"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/expenses", label: "Business Expenses" },
  { href: "/reports", label: "Monthly Reports" },
  { href: "/products", label: "Product Analysis" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ showSignOut }: { showSignOut: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (pathname === "/login") return null;

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
          {LINKS.map((l) => (
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
        {showSignOut && (
          <button onClick={signOut} className="mt-6 w-full rounded-md px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white">
            Sign out
          </button>
        )}
      </nav>
    </aside>
  );
}
