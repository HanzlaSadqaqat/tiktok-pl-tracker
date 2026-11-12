import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { expenseWithCalc } from "@/lib/calc";
import { isISODate } from "@/lib/periods";
import { createExpense, getSettings, listExpenses } from "@/lib/repo";
import { requireClientApi } from "@/lib/session";
import { expenseSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "view");
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start") ?? undefined;
  const end = sp.get("end") ?? undefined;
  const [expenses, settings] = await Promise.all([
    listExpenses(client.id, { start: isISODate(start) ? start : undefined, end: isISODate(end) ? end : undefined }),
    getSettings(client.id),
  ]);
  return NextResponse.json({ expenses: expenseWithCalc(expenses, settings), settings });
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { client, user } = await requireClientApi((await ctx.params).clientId, "edit");
  const expense = await createExpense(client.id, user.id, await parseBody(req, expenseSchema));
  return NextResponse.json({ expense }, { status: 201 });
});
