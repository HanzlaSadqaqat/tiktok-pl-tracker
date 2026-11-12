import { NextResponse } from "next/server";
import { HttpError, handle, isObjectId, parseBody } from "@/lib/api";
import { listPeople, removeMembership, setMembership } from "@/lib/clients";
import { requireClientApi } from "@/lib/session";
import { setAccessSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string; userId: string }> };

/** Changes a member's access on this client. Admins only. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { clientId, userId } = await ctx.params;
  const { client } = await requireClientApi(clientId, "admin");
  if (!isObjectId(userId)) throw new HttpError(404, "User not found");
  const { access } = await parseBody(req, setAccessSchema);
  await setMembership(client.id, userId, access);
  return NextResponse.json({ people: await listPeople(client.id) });
});

/** Removes a member's access to this client (takes effect on their next request). Admins only. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { clientId, userId } = await ctx.params;
  const { client } = await requireClientApi(clientId, "admin");
  if (!isObjectId(userId) || !(await removeMembership(client.id, userId))) throw new HttpError(404, "This person has no access to this client");
  return NextResponse.json({ people: await listPeople(client.id) });
});
