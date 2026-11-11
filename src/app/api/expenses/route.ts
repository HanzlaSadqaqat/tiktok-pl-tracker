import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { expenseWithCalc } from "@/lib/calc";
import { isISODate } from "@/lib/periods";
import { createExpense, getSettings, listExpenses } from "@/lib/repo";
import { expenseSchema } from "@/lib/validation";

export const GET = handle(async (req: Request) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start") ?? undefined;
  const end = sp.get("end") ?? undefined;
  const [expenses, settings] = await Promise.all([
    listExpenses({ start: isISODate(start) ? start : undefined, end: isISODate(end) ? end : undefined }),
    getSettings(),
  ]);
  return NextResponse.json({ expenses: expenseWithCalc(expenses, settings), settings });
});

export const POST = handle(async (req: Request) => {
  await requireUser("editor");
  const expense = await createExpense(await parseBody(req, expenseSchema));
  return NextResponse.json({ expense }, { status: 201 });
});
