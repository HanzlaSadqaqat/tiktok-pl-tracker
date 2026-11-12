import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { withCalc } from "@/lib/calc";
import { isISODate } from "@/lib/periods";
import { createOrder, getSettings, listOrders } from "@/lib/repo";
import { requireClientApi } from "@/lib/session";
import { orderSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "view");
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start") ?? undefined;
  const end = sp.get("end") ?? undefined;
  const [orders, settings] = await Promise.all([
    listOrders(client.id, { start: isISODate(start) ? start : undefined, end: isISODate(end) ? end : undefined }),
    getSettings(client.id),
  ]);
  return NextResponse.json({ orders: withCalc(orders, settings), settings });
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { client, user } = await requireClientApi((await ctx.params).clientId, "edit");
  const order = await createOrder(client.id, user.id, await parseBody(req, orderSchema));
  return NextResponse.json({ order }, { status: 201 });
});
