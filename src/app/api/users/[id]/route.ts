import { NextResponse } from "next/server";
import { HttpError, handle, isObjectId, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { deleteUser, updateUser } from "@/lib/users";
import { updateUserSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireUser("admin");
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(404, "User not found");
  const user = await updateUser(id, admin.id, await parseBody(req, updateUserSchema));
  return NextResponse.json({ user });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const admin = await requireUser("admin");
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(404, "User not found");
  await deleteUser(id, admin.id);
  return NextResponse.json({ ok: true });
});
