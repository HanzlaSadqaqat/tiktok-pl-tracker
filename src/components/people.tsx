"use client";

import { useState } from "react";

/** A readable random password, e.g. "kite-Rv8q-maple-42". */
export function generatePassword() {
  const words = ["amber", "cedar", "delta", "ember", "falcon", "harbor", "kite", "lotus", "maple", "nova", "orbit", "pixel", "river", "sable", "tiger", "zephyr"];
  const r = new Uint32Array(4);
  crypto.getRandomValues(r);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const mid = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => chars[n % chars.length]).join("");
  return `${words[r[0] % words.length]}-${mid}-${words[r[1] % words.length]}-${10 + (r[2] % 90)}`;
}

/** Sign-in details with a Copy button, shown once after creating a user or resetting a password. */
export function Credentials({ email, password }: { email: string; password: string }) {
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
