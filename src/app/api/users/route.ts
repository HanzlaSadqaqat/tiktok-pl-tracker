import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createUser, listUsers } from "@/lib/users";
import { createUserSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requireUser("admin");
  return NextResponse.json({ users: await listUsers() });
});

export const POST = handle(async (req: Request) => {
  await requireUser("admin");
  const user = await createUser(await parseBody(req, createUserSchema));
  return NextResponse.json({ user }, { status: 201 });
});
