import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { expensesFromCsv } from "@/lib/importers";
import { importExpenses } from "@/lib/repo";
import { requireClientApi } from "@/lib/session";
import { expenseSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { client, user } = await requireClientApi((await ctx.params).clientId, "edit");
  const { csv } = await parseBody(req, z.object({ csv: z.string().max(5_000_000) }));
  const { rows, errors } = expensesFromCsv(csv);
  const valid = rows.flatMap((r, i) => {
    const p = expenseSchema.safeParse(r);
    if (!p.success) errors.push(`Expense ${r.name || i + 1}: ${p.error.issues[0]?.message}`);
    return p.success ? [p.data] : [];
  });
  const result = await importExpenses(client.id, user.id, valid);
  return NextResponse.json({ ...result, errors });
});
