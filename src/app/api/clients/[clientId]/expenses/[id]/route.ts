import { NextResponse } from "next/server";
import { HttpError, handle, isObjectId, parseBody } from "@/lib/api";
import { deleteExpense, updateExpense } from "@/lib/repo";
import { requireClientApi } from "@/lib/session";
import { expenseSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string; id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { clientId, id } = await ctx.params;
  const { client, user } = await requireClientApi(clientId, "edit");
  if (!isObjectId(id)) throw new HttpError(404, "Expense not found");
  // Matches { _id, clientId }: an expense id from another client is simply not found.
  const expense = await updateExpense(client.id, user.id, id, await parseBody(req, expenseSchema));
  if (!expense) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ expense });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { clientId, id } = await ctx.params;
  const { client } = await requireClientApi(clientId, "edit");
  if (!isObjectId(id) || !(await deleteExpense(client.id, id))) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ ok: true });
});
