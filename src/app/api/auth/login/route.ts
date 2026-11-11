import { NextResponse } from "next/server";
import { HttpError, handle, parseBody } from "@/lib/api";
import { sessionSecretConfigured } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { authenticate, toPublicUser } from "@/lib/users";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  if (!sessionSecretConfigured()) throw new HttpError(500, "SESSION_SECRET is not set. Add a random string of at least 32 characters to .env.local.");
  const { email, password } = await parseBody(req, loginSchema);
  let user;
  try {
    user = await authenticate(email, password);
  } catch (err) {
    // Slow down guessing.
    if (err instanceof HttpError && err.status === 401) await new Promise((r) => setTimeout(r, 500));
    throw err;
  }
  const res = NextResponse.json({ user: toPublicUser(user) });
  await setSessionCookie(res, user._id.toString(), user.sessionVersion);
  return res;
});
