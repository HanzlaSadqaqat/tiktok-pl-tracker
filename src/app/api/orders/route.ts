import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { withCalc } from "@/lib/calc";
import { isISODate } from "@/lib/periods";
import { createOrder, getSettings, listOrders } from "@/lib/repo";
import { orderSchema } from "@/lib/validation";

export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start") ?? undefined;
  const end = sp.get("end") ?? undefined;
  const [orders, settings] = await Promise.all([
    listOrders({ start: isISODate(start) ? start : undefined, end: isISODate(end) ? end : undefined }),
    getSettings(),
  ]);
  return NextResponse.json({ orders: withCalc(orders, settings), settings });
});

export const POST = handle(async (req: Request) => {
  const input = await parseBody(req, orderSchema);
  const order = await createOrder(input);
  return NextResponse.json({ order }, { status: 201 });
});
