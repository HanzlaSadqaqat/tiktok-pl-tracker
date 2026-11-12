import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { cache } from "react";
import { HttpError } from "./api";
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken, verifySessionToken } from "./auth";
import { accessFor, findClient } from "./clients";
import { meetsLevel, type ClientLevel, type EffectiveAccess, type Role } from "./constants";
import type { Client, SessionUser } from "./types";
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

/** For API routes: returns the user, or throws 401 (not signed in) / 403 (not an admin when `role` is "admin"). */
export async function requireUser(role: Role = "member"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Your session has ended. Please sign in again.");
  if (role === "admin" && user.role !== "admin") throw new HttpError(403, "You do not have permission to do this");
  return user;
}

/** For pages: returns the user, or sends them to sign in / shows 404 when they are not an admin and `role` is "admin". */
export async function requirePage(role: Role = "member"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role === "admin" && user.role !== "admin") notFound();
  return user;
}

export interface ClientAccessResult {
  client: Client;
  access: EffectiveAccess;
  /** False on archived clients for everyone except admins (members cannot see archived clients at all). */
  canEdit: boolean;
}

/**
 * THE access check for everything that belongs to a client. Every client page and API route calls it.
 *
 * - No client, or no access to it: 404, so nobody can discover other clients' names.
 * - Members never see archived clients (404).
 * - Access too low on a client the user can see: 403.
 * - Reads the user, client and membership fresh on every request, so removed access applies straight away.
 */
export async function requireClientAccess(user: SessionUser, clientSlugOrId: string, need: ClientLevel): Promise<ClientAccessResult> {
  const notFoundErr = new HttpError(404, "Client not found");
  const client = await findClient(clientSlugOrId);
  if (!client) throw notFoundErr;
  const access = await accessFor(user, client);
  if (!access) throw notFoundErr;
  if (!meetsLevel(access, need)) throw new HttpError(403, "You do not have permission to do this");
  return { client, access, canEdit: meetsLevel(access, "edit") };
}

/** API routes: signed-in user plus their access to the client in the URL. */
export async function requireClientApi(clientSlugOrId: string, need: ClientLevel) {
  const user = await requireUser();
  return { user, ...(await requireClientAccess(user, clientSlugOrId, need)) };
}

/** Pages: like requireClientApi, but redirects to sign-in or shows the 404 page instead of throwing. */
export async function requireClientPage(clientSlugOrId: string, need: ClientLevel = "view") {
  const user = await requirePage();
  try {
    return { user, ...(await requireClientAccess(user, clientSlugOrId, need)) };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
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
