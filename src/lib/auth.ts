/**
 * Session tokens. The cookie holds "<userId>.<sessionVersion>.<expiryMs>.<hex HMAC-SHA256>" signed with
 * SESSION_SECRET. It uses Web Crypto so the proxy can check it without a database call.
 *
 * The proxy only checks the signature and expiry. Pages and API routes then load the user
 * (see session.ts), so a deactivated user or a reset password takes effect on the next request.
 */
export const SESSION_COOKIE = "tt_session";
export const SESSION_DAYS = 30;

export const sessionSecretConfigured = () => (process.env.SESSION_SECRET ?? "").length >= 32;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  return s;
}

export async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface SessionClaims {
  userId: string;
  sessionVersion: number;
  expires: number;
}

export async function createSessionToken(userId: string, sessionVersion: number, now = Date.now()): Promise<string> {
  const payload = `${userId}.${sessionVersion}.${now + SESSION_DAYS * 86400_000}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the claims when the token is well formed, correctly signed and not expired. */
export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<SessionClaims | null> {
  if (!token || !sessionSecretConfigured()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sv, exp, sig] = parts;
  if (!/^[a-f0-9]{24}$/i.test(userId) || !/^\d+$/.test(sv) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) < now) return null;
  if (!safeEqual(sig, await hmac(`${userId}.${sv}.${exp}`))) return null;
  return { userId, sessionVersion: Number(sv), expires: Number(exp) };
}

/** Compares two secrets in constant time by comparing their HMACs. */
export async function secretsMatch(a: string, b: string): Promise<boolean> {
  return safeEqual(await hmac(`pw:${a}`), await hmac(`pw:${b}`));
}
