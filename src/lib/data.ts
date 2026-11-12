import "server-only";
import { Types } from "mongoose";
import { expenseWithCalc, summarize, withCalc } from "./calc";
import { toClient } from "./clients";
import { connectDb } from "./db";
import { ClientModel, ExpenseModel, OrderModel, SettingsModel, type ClientDoc } from "./models";
import { todayIn } from "./periods";
import { getSettings, listExpenses, listOrders, settingsFromDoc } from "./repo";
import type { Client, Expense, ISODate, Order } from "./types";

export const timeZone = () => process.env.APP_TIMEZONE || "Asia/Karachi";

/** Everything one client's report pages need, with profit already worked out. */
export async function loadAll(clientId: string) {
  const [orders, expenses, settings] = await Promise.all([listOrders(clientId), listExpenses(clientId), getSettings(clientId)]);
  return {
    settings,
    orders: withCalc(orders, settings),
    expenses: expenseWithCalc(expenses, settings),
    today: todayIn(timeZone()),
  };
}

export interface OverviewRow {
  client: Client;
  currency: string;
  lowMarginThreshold: number;
  orders: number;
  revenue: number;
  grossProfit: number;
  businessExpenses: number;
  netProfit: number;
  netMargin: number;
  lastOrderDate: ISODate | null;
  fxMissing: boolean;
}

/**
 * Agency overview: one summary per active client for a period. This is the only code that reads
 * orders and expenses across clients, and it returns totals only, never the rows themselves.
 * Each client is summarised separately with its own settings and the existing summarize().
 */
export async function loadOverview(start: ISODate, end: ISODate): Promise<OverviewRow[]> {
  await connectDb();
  const clients = ((await ClientModel.find({ status: "Active" }).sort({ name: 1 }).lean()) as (ClientDoc & { _id: Types.ObjectId })[]).map(toClient);
  if (!clients.length) return [];
  const ids = clients.map((c) => new Types.ObjectId(c.id));

  // Only the period's rows are loaded; the { clientId, orderDate } and { clientId, date } indexes serve these queries.
  const [settingsDocs, orderDocs, expenseDocs, lastOrders] = await Promise.all([
    SettingsModel.find({ clientId: { $in: ids } }).lean(),
    OrderModel.find({ clientId: { $in: ids }, orderDate: { $gte: start, $lte: end } }).lean(),
    ExpenseModel.find({ clientId: { $in: ids }, date: { $gte: start, $lte: end } }).lean(),
    OrderModel.aggregate<{ _id: Types.ObjectId; last: string }>([
      { $match: { clientId: { $in: ids } } },
      { $group: { _id: "$clientId", last: { $max: "$orderDate" } } },
    ]),
  ]);

  const group = <T extends { clientId: Types.ObjectId }>(docs: T[]) => {
    const m = new Map<string, T[]>();
    for (const d of docs) m.set(d.clientId.toString(), [...(m.get(d.clientId.toString()) ?? []), d]);
    return m;
  };
  const settingsBy = new Map(settingsDocs.map((s) => [s.clientId.toString(), s]));
  const ordersBy = group(orderDocs);
  const expensesBy = group(expenseDocs);
  const lastBy = new Map(lastOrders.map((l) => [l._id.toString(), l.last]));
  const plain = <T,>(d: unknown) => ({ ...(d as object), id: String((d as { _id: unknown })._id) }) as T;

  return clients.map((client) => {
    const settings = settingsFromDoc((settingsBy.get(client.id) as Record<string, unknown> | undefined) ?? null);
    const orders = withCalc((ordersBy.get(client.id) ?? []).map((d) => plain<Order>({ ...d, taxTreatment: d.taxTreatment ?? null })), settings);
    const expenses = expenseWithCalc((expensesBy.get(client.id) ?? []).map((d) => plain<Expense>(d)), settings);
    const s = summarize(orders, expenses, start, end);
    return {
      client,
      currency: settings.reportingCurrency,
      lowMarginThreshold: settings.lowMarginThreshold,
      orders: s.countedOrders,
      revenue: s.revenue,
      grossProfit: s.grossProfit,
      businessExpenses: s.businessExpenses,
      netProfit: s.netProfit,
      netMargin: s.netMargin,
      lastOrderDate: lastBy.get(client.id) ?? null,
      fxMissing: orders.some((o) => o.calc.fxMissing) || expenses.some((e) => e.fxMissing),
    };
  });
}
