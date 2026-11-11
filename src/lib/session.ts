import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { cache } from "react";
import { HttpError } from "./api";
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken, verifySessionToken } from "./auth";
import { hasRole, type Role } from "./constants";
import type { SessionUser } from "./types";
import { getUserById } from "./users";

/**
 * The signed-in user, or null. Loads the account on every request, so deactivating a user
 * or resetting their password takes effect straight away. Cached for the length of one request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await getUserById(claims.userId);
  if (!user || !user.active || user.sessionVersion !== claims.sessionVersion) return null;
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
});

/** For API routes: returns the user, or throws 401 (not signed in) / 403 (not allowed). */
export async function requireUser(role: Role = "viewer"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Your session has ended. Please sign in again.");
  if (!hasRole(user.role, role)) throw new HttpError(403, "You do not have permission to do this");
  return user;
}

/** For pages: returns the user, or sends them to sign in / shows 404 when their role is too low. */
export async function requirePage(role: Role = "viewer"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasRole(user.role, role)) notFound();
  return user;
}

export async function setSessionCookie(res: NextResponse, userId: string, sessionVersion: number) {
  res.cookies.set(SESSION_COOKIE, await createSessionToken(userId, sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}
