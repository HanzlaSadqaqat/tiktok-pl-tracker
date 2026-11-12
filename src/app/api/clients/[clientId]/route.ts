import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { deleteClient, updateClient } from "@/lib/clients";
import { requireClientApi } from "@/lib/session";
import { deleteClientSchema, updateClientSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { client, access } = await requireClientApi((await ctx.params).clientId, "view");
  return NextResponse.json({ client, access });
});

/** Edit details, archive (status "Archived") or unarchive. Admins only. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "admin");
  return NextResponse.json({ client: await updateClient(client.id, await parseBody(req, updateClientSchema)) });
});

/** Permanently deletes an archived client and all its data. Body: { confirmName }. Admins only. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "admin");
  const { confirmName } = await parseBody(req, deleteClientSchema);
  return NextResponse.json({ deleted: await deleteClient(client.id, confirmName) });
});
