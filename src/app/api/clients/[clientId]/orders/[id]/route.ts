import { NextResponse } from "next/server";
import { HttpError, handle, isObjectId, parseBody } from "@/lib/api";
import { deleteOrder, updateOrder } from "@/lib/repo";
import { requireClientApi } from "@/lib/session";
import { orderSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string; id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { clientId, id } = await ctx.params;
  const { client, user } = await requireClientApi(clientId, "edit");
  if (!isObjectId(id)) throw new HttpError(404, "Order not found");
  // Matches { _id, clientId }: an order id from another client is simply not found.
  const order = await updateOrder(client.id, user.id, id, await parseBody(req, orderSchema));
  if (!order) throw new HttpError(404, "Order not found");
  return NextResponse.json({ order });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { clientId, id } = await ctx.params;
  const { client } = await requireClientApi(clientId, "edit");
  if (!isObjectId(id) || !(await deleteOrder(client.id, id))) throw new HttpError(404, "Order not found");
  return NextResponse.json({ ok: true });
});
