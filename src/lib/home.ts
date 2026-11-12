import "server-only";
import { cookies } from "next/headers";
import { clientsForUser } from "./clients";
import { LAST_CLIENT_COOKIE } from "./constants";
import type { ClientWithAccess, SessionUser } from "./types";

/** The client to open by default: the last one used (if still accessible and active), else the first. */
export async function defaultClient(user: SessionUser, clients?: ClientWithAccess[]): Promise<ClientWithAccess | null> {
  const list = (clients ?? (await clientsForUser(user))).filter((c) => c.status === "Active");
  const last = (await cookies()).get(LAST_CLIENT_COOKIE)?.value;
  return list.find((c) => c.id === last) ?? list[0] ?? null;
}
