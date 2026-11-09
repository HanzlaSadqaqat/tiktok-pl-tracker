import "server-only";
import { connectDb } from "./db";
import { ExpenseModel, OrderModel, SettingsModel } from "./models";
import type { AppSettings, Expense, ExpenseInput, Order, OrderInput } from "./types";

const DEFAULT_SETTINGS: AppSettings = {
  reportingCurrency: "USD",
  lowMarginThreshold: 0.15,
  defaultTaxTreatment: "On top of price",
  rates: {},
  ratesUpdatedAt: null,
};

type Lean<T> = T & { _id: { toString(): string } };

/** Strips Mongo bookkeeping fields and exposes the id as a string. */
function clean<T>(d: Lean<T>): T & { id: string } {
  const { _id, __v, createdAt, updatedAt, ...rest } = d as Lean<T> & Record<string, unknown>;
  void __v; void createdAt; void updatedAt;
  return { id: _id.toString(), ...(rest as T) };
}

const toOrder = (d: Lean<OrderInput>): Order => {
  const o = clean(d);
  return { ...o, taxTreatment: o.taxTreatment ?? null };
};
const toExpense = (d: Lean<ExpenseInput>): Expense => clean(d);

export async function getSettings(): Promise<AppSettings> {
  await connectDb();
  const doc = await SettingsModel.findOne({ key: "main" }).lean();
  if (!doc) return { ...DEFAULT_SETTINGS };
  const rates = doc.rates instanceof Map ? Object.fromEntries(doc.rates) : ((doc.rates as unknown as Record<string, number>) ?? {});
  return {
    reportingCurrency: doc.reportingCurrency,
    lowMarginThreshold: doc.lowMarginThreshold,
    defaultTaxTreatment: doc.defaultTaxTreatment,
    rates,
    ratesUpdatedAt: doc.ratesUpdatedAt ?? null,
  };
}

export async function saveSettings(s: Partial<AppSettings>): Promise<AppSettings> {
  await connectDb();
  await SettingsModel.updateOne({ key: "main" }, { $set: s }, { upsert: true });
  return getSettings();
}

export async function listOrders(filter: { start?: string; end?: string } = {}): Promise<Order[]> {
  await connectDb();
  const q: Record<string, unknown> = {};
  if (filter.start || filter.end) q.orderDate = { ...(filter.start && { $gte: filter.start }), ...(filter.end && { $lte: filter.end }) };
  const docs = await OrderModel.find(q).sort({ orderDate: -1, createdAt: -1 }).lean();
  return docs.map((d) => toOrder(d as Lean<OrderInput>));
}

export async function createOrder(input: OrderInput): Promise<Order> {
  await connectDb();
  const doc = await OrderModel.create(input);
  return toOrder(doc.toObject() as Lean<OrderInput>);
}

export async function updateOrder(id: string, input: OrderInput): Promise<Order | null> {
  await connectDb();
  const doc = await OrderModel.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean();
  return doc ? toOrder(doc as Lean<OrderInput>) : null;
}

export async function deleteOrder(id: string): Promise<boolean> {
  await connectDb();
  const res = await OrderModel.findByIdAndDelete(id);
  return !!res;
}

/** Inserts orders, skipping any whose Order ID already exists. */
export async function importOrders(inputs: OrderInput[]): Promise<{ inserted: number; skipped: number }> {
  await connectDb();
  if (!inputs.length) return { inserted: 0, skipped: 0 };
  const existing = new Set(
    (await OrderModel.find({ orderId: { $in: inputs.map((i) => i.orderId) } }, { orderId: 1 }).lean()).map((d) => d.orderId),
  );
  const fresh = inputs.filter((i, idx) => !existing.has(i.orderId) && inputs.findIndex((j) => j.orderId === i.orderId) === idx);
  if (fresh.length) await OrderModel.insertMany(fresh, { ordered: false });
  return { inserted: fresh.length, skipped: inputs.length - fresh.length };
}

export async function listExpenses(filter: { start?: string; end?: string } = {}): Promise<Expense[]> {
  await connectDb();
  const q: Record<string, unknown> = {};
  if (filter.start || filter.end) q.date = { ...(filter.start && { $gte: filter.start }), ...(filter.end && { $lte: filter.end }) };
  const docs = await ExpenseModel.find(q).sort({ date: -1, createdAt: -1 }).lean();
  return docs.map((d) => toExpense(d as Lean<ExpenseInput>));
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  await connectDb();
  const doc = await ExpenseModel.create(input);
  return toExpense(doc.toObject() as Lean<ExpenseInput>);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense | null> {
  await connectDb();
  const doc = await ExpenseModel.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean();
  return doc ? toExpense(doc as Lean<ExpenseInput>) : null;
}

export async function deleteExpense(id: string): Promise<boolean> {
  await connectDb();
  const res = await ExpenseModel.findByIdAndDelete(id);
  return !!res;
}

/** Inserts expenses, skipping rows with the same date, name and amount as an existing one. */
export async function importExpenses(inputs: ExpenseInput[]): Promise<{ inserted: number; skipped: number }> {
  await connectDb();
  if (!inputs.length) return { inserted: 0, skipped: 0 };
  const key = (e: Pick<ExpenseInput, "date" | "name" | "amount">) => `${e.date}|${e.name.toLowerCase()}|${e.amount}`;
  const existing = await ExpenseModel.find({ date: { $in: [...new Set(inputs.map((i) => i.date))] } }, { date: 1, name: 1, amount: 1 }).lean();
  const seen = new Set(existing.map(key));
  const fresh = inputs.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (fresh.length) await ExpenseModel.insertMany(fresh, { ordered: false });
  return { inserted: fresh.length, skipped: inputs.length - fresh.length };
}
