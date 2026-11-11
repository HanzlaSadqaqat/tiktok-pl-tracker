import { NextResponse } from "next/server";
import { HttpError, handle, isObjectId, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { deleteExpense, updateExpense } from "@/lib/repo";
import { expenseSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireUser("editor");
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(404, "Expense not found");
  const expense = await updateExpense(id, await parseBody(req, expenseSchema));
  if (!expense) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ expense });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireUser("editor");
  const { id } = await ctx.params;
  if (!isObjectId(id) || !(await deleteExpense(id))) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ ok: true });
});
