import "server-only";
import { connectDb } from "./db";
import { DEFAULT_SETTINGS } from "./defaults";
import { ExpenseModel, OrderModel, SettingsModel } from "./models";
import type { AppSettings, Expense, ExpenseInput, Order, OrderInput } from "./types";

/**
 * Database access for one client's orders, expenses and settings.
 *
 * SECURITY: every function takes `clientId` as its first argument and every query filters on it.
 * Updates and deletes match `{ _id, clientId }`, so an id from client A can never touch client B.
 * Callers must get `clientId` from `requireClientAccess()` (session.ts), never straight from a request.
 */

export { DEFAULT_SETTINGS };

type Lean<T> = T & { _id: { toString(): string } };

/** Strips Mongo bookkeeping and ownership fields and exposes the id as a string. */
function clean<T>(d: Lean<T>): T & { id: string } {
  const { _id, __v, createdAt, updatedAt, clientId, createdBy, updatedBy, ...rest } = d as Lean<T> & Record<string, unknown>;
  void __v; void createdAt; void updatedAt; void clientId; void createdBy; void updatedBy;
  return { id: _id.toString(), ...(rest as T) };
}

const toOrder = (d: unknown): Order => {
  const o = clean(d as Lean<OrderInput>);
  return { ...o, taxTreatment: o.taxTreatment ?? null };
};
const toExpense = (d: unknown): Expense => clean(d as Lean<ExpenseInput>);

const dateRange = (filter: { start?: string; end?: string }) =>
  filter.start || filter.end ? { ...(filter.start && { $gte: filter.start }), ...(filter.end && { $lte: filter.end }) } : undefined;

// ---------------------------------------------------------------- Settings

export function settingsFromDoc(doc: Record<string, unknown> | null): AppSettings {
  if (!doc) return { ...DEFAULT_SETTINGS };
  const rates = doc.rates instanceof Map ? Object.fromEntries(doc.rates) : ((doc.rates as Record<string, number>) ?? {});
  return {
    reportingCurrency: (doc.reportingCurrency as string) ?? DEFAULT_SETTINGS.reportingCurrency,
    lowMarginThreshold: (doc.lowMarginThreshold as number) ?? DEFAULT_SETTINGS.lowMarginThreshold,
    defaultTaxTreatment: (doc.defaultTaxTreatment as AppSettings["defaultTaxTreatment"]) ?? DEFAULT_SETTINGS.defaultTaxTreatment,
    rates,
    ratesUpdatedAt: (doc.ratesUpdatedAt as string | null) ?? null,
  };
}

export async function getSettings(clientId: string): Promise<AppSettings> {
  await connectDb();
  return settingsFromDoc(await SettingsModel.findOne({ clientId }).lean());
}

export async function saveSettings(clientId: string, s: Partial<AppSettings>): Promise<AppSettings> {
  await connectDb();
  await SettingsModel.updateOne({ clientId }, { $set: s, $setOnInsert: { clientId } }, { upsert: true, runValidators: true });
  return getSettings(clientId);
}

// ---------------------------------------------------------------- Orders

export async function listOrders(clientId: string, filter: { start?: string; end?: string } = {}): Promise<Order[]> {
  await connectDb();
  const range = dateRange(filter);
  const docs = await OrderModel.find({ clientId, ...(range && { orderDate: range }) }).sort({ orderDate: -1, createdAt: -1 }).lean();
  return docs.map(toOrder);
}

export async function createOrder(clientId: string, userId: string | null, input: OrderInput): Promise<Order> {
  await connectDb();
  const doc = await OrderModel.create({ ...input, clientId, createdBy: userId, updatedBy: userId });
  return toOrder(doc.toObject());
}

export async function updateOrder(clientId: string, userId: string | null, id: string, input: OrderInput): Promise<Order | null> {
  await connectDb();
  const doc = await OrderModel.findOneAndUpdate(
    { _id: id, clientId },
    { $set: { ...input, updatedBy: userId } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  return doc ? toOrder(doc) : null;
}

export async function deleteOrder(clientId: string, id: string): Promise<boolean> {
  await connectDb();
  return !!(await OrderModel.findOneAndDelete({ _id: id, clientId }));
}

/** Inserts orders, skipping any whose Order ID already exists for this client (or repeats in the file). */
export async function importOrders(clientId: string, userId: string | null, inputs: OrderInput[]): Promise<{ inserted: number; skipped: number }> {
  await connectDb();
  if (!inputs.length) return { inserted: 0, skipped: 0 };
  const existing = new Set(
    (await OrderModel.find({ clientId, orderId: { $in: inputs.map((i) => i.orderId) } }, { orderId: 1 }).lean()).map((d) => d.orderId),
  );
  const fresh = inputs.filter((i, idx) => !existing.has(i.orderId) && inputs.findIndex((j) => j.orderId === i.orderId) === idx);
  if (fresh.length) {
    await OrderModel.insertMany(
      fresh.map((o) => ({ ...o, clientId, createdBy: userId, updatedBy: userId })),
      { ordered: false },
    );
  }
  return { inserted: fresh.length, skipped: inputs.length - fresh.length };
}

// ---------------------------------------------------------------- Business expenses

export async function listExpenses(clientId: string, filter: { start?: string; end?: string } = {}): Promise<Expense[]> {
  await connectDb();
  const range = dateRange(filter);
  const docs = await ExpenseModel.find({ clientId, ...(range && { date: range }) }).sort({ date: -1, createdAt: -1 }).lean();
  return docs.map(toExpense);
}

export async function createExpense(clientId: string, userId: string | null, input: ExpenseInput): Promise<Expense> {
  await connectDb();
  const doc = await ExpenseModel.create({ ...input, clientId, createdBy: userId, updatedBy: userId });
  return toExpense(doc.toObject());
}

export async function updateExpense(clientId: string, userId: string | null, id: string, input: ExpenseInput): Promise<Expense | null> {
  await connectDb();
  const doc = await ExpenseModel.findOneAndUpdate(
    { _id: id, clientId },
    { $set: { ...input, updatedBy: userId } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  return doc ? toExpense(doc) : null;
}

export async function deleteExpense(clientId: string, id: string): Promise<boolean> {
  await connectDb();
  return !!(await ExpenseModel.findOneAndDelete({ _id: id, clientId }));
}

/** Inserts expenses, skipping rows with the same date, name and amount as an existing one for this client. */
export async function importExpenses(clientId: string, userId: string | null, inputs: ExpenseInput[]): Promise<{ inserted: number; skipped: number }> {
  await connectDb();
  if (!inputs.length) return { inserted: 0, skipped: 0 };
  const key = (e: Pick<ExpenseInput, "date" | "name" | "amount">) => `${e.date}|${e.name.toLowerCase()}|${e.amount}`;
  const existing = await ExpenseModel.find(
    { clientId, date: { $in: [...new Set(inputs.map((i) => i.date))] } },
    { date: 1, name: 1, amount: 1 },
  ).lean();
  const seen = new Set(existing.map(key));
  const fresh = inputs.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (fresh.length) {
    await ExpenseModel.insertMany(
      fresh.map((e) => ({ ...e, clientId, createdBy: userId, updatedBy: userId })),
      { ordered: false },
    );
  }
  return { inserted: fresh.length, skipped: inputs.length - fresh.length };
}
