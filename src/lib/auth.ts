/**
 * Single-password sign-in. The session cookie holds an expiry time and an
 * HMAC-SHA256 signature made with SESSION_SECRET (Web Crypto, so it also runs in the proxy).
 */
export const SESSION_COOKIE = "tt_session";
export const SESSION_DAYS = 30;

export const authEnabled = () => Boolean(process.env.APP_PASSWORD);

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters when APP_PASSWORD is used.");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_DAYS * 86400_000);
  return `${expires}.${await hmac(expires)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < now) return false;
  return safeEqual(sig, await hmac(expires));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD ?? "";
  // Compare HMACs so the comparison time does not depend on where the strings differ.
  return safeEqual(await hmac(`pw:${input}`), await hmac(`pw:${expected}`));
}
