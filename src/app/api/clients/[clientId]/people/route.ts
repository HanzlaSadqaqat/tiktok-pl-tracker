import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { listPeople, setMembership } from "@/lib/clients";
import { requireClientApi } from "@/lib/session";
import { createUser } from "@/lib/users";
import { addPersonSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string }> };

/** Members with access to this client. Admins only. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "admin");
  return NextResponse.json({ people: await listPeople(client.id) });
});

/** Gives an existing user access ({ userId, access }) or invites a new one ({ name, email, password, access }). */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "admin");
  const body = await parseBody(req, addPersonSchema);
  if ("userId" in body) {
    await setMembership(client.id, body.userId, body.access);
  } else {
    await createUser({ ...body, role: "member", memberships: [{ clientId: client.id, access: body.access }] });
  }
  return NextResponse.json({ people: await listPeople(client.id) }, { status: 201 });
});
