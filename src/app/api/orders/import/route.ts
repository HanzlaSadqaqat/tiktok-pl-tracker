import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ordersFromCsv } from "@/lib/importers";
import { importOrders } from "@/lib/repo";
import { orderSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await requireUser("editor");
  const { csv } = await parseBody(req, z.object({ csv: z.string().max(5_000_000) }));
  const { rows, errors } = ordersFromCsv(csv);
  const valid = rows.flatMap((r, i) => {
    const p = orderSchema.safeParse(r);
    if (!p.success) errors.push(`Order ${r.orderId || i + 1}: ${p.error.issues[0]?.message}`);
    return p.success ? [p.data] : [];
  });
  const result = await importOrders(valid);
  return NextResponse.json({ ...result, errors });
});
