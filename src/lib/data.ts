import "server-only";
import { expenseWithCalc, withCalc } from "./calc";
import { todayIn } from "./periods";
import { getSettings, listExpenses, listOrders } from "./repo";

export const timeZone = () => process.env.APP_TIMEZONE || "Asia/Karachi";

/** Everything the report pages need, with profit already worked out. */
export async function loadAll() {
  const [orders, expenses, settings] = await Promise.all([listOrders(), listExpenses(), getSettings()]);
  return {
    settings,
    orders: withCalc(orders, settings),
    expenses: expenseWithCalc(expenses, settings),
    today: todayIn(timeZone()),
  };
}
