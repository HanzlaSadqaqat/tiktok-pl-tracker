import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { expensesFromCsv } from "@/lib/importers";
import { importExpenses } from "@/lib/repo";
import { expenseSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  await requireUser("editor");
  const { csv } = await parseBody(req, z.object({ csv: z.string().max(5_000_000) }));
  const { rows, errors } = expensesFromCsv(csv);
  const valid = rows.flatMap((r, i) => {
    const p = expenseSchema.safeParse(r);
    if (!p.success) errors.push(`Expense ${r.name || i + 1}: ${p.error.issues[0]?.message}`);
    return p.success ? [p.data] : [];
  });
  const result = await importExpenses(valid);
  return NextResponse.json({ ...result, errors });
});
