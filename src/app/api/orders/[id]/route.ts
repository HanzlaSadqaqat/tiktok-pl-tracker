import { NextResponse } from "next/server";
import { HttpError, handle, isObjectId, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { deleteOrder, updateOrder } from "@/lib/repo";
import { orderSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireUser("editor");
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(404, "Order not found");
  const order = await updateOrder(id, await parseBody(req, orderSchema));
  if (!order) throw new HttpError(404, "Order not found");
  return NextResponse.json({ order });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireUser("editor");
  const { id } = await ctx.params;
  if (!isObjectId(id) || !(await deleteOrder(id))) throw new HttpError(404, "Order not found");
  return NextResponse.json({ ok: true });
});
