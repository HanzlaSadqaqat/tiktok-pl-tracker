import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { clientsForUser, createClient } from "@/lib/clients";
import { requireUser } from "@/lib/session";
import { createClientSchema } from "@/lib/validation";

/** Clients the signed-in user can open (all of them for admins). */
export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json({ clients: await clientsForUser(user) });
});

/** Creates a client and its settings. Admins only. */
export const POST = handle(async (req: Request) => {
  await requireUser("admin");
  const { reportingCurrency, ...input } = await parseBody(req, createClientSchema);
  const client = await createClient(input, { reportingCurrency });
  return NextResponse.json({ client }, { status: 201 });
});
