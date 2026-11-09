import type {
  AppSettings,
  Expense,
  ExpenseWithCalc,
  ISODate,
  Order,
  OrderCalc,
  OrderWithCalc,
} from "./types";
import { monthEnd } from "./periods";

const n = (v: number | null | undefined) => (Number.isFinite(v) ? (v as number) : 0);
const div = (a: number, b: number) => (b === 0 ? 0 : a / b);
const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** Value of 1 unit of `currency` in the reporting currency. */
export function fxRate(currency: string, settings: AppSettings): { rate: number; missing: boolean } {
  const c = (currency || "").trim().toUpperCase();
  if (!c || c === settings.reportingCurrency) return { rate: 1, missing: false };
  const r = settings.rates[c];
  if (r && r > 0) return { rate: r, missing: false };
  return { rate: 1, missing: true };
}

/**
 * Profit for one order, converted to the reporting currency.
 * Cancelled orders count as zero. Refunds reduce revenue. Sales tax is a cost
 * only when it is deducted from the payout, so it is never counted twice.
 */
export function computeOrder(o: Order, settings: AppSettings): OrderCalc {
  const { rate, missing } = fxRate(o.currency, settings);
  const live = o.status === "Cancelled" ? 0 : 1;
  const qty = n(o.quantity);

  const grossSales = qty * n(o.salePrice) * rate;
  const revenue = live * (qty * n(o.salePrice) - n(o.refund)) * rate;
  const productCost = live * qty * n(o.buyPrice) * rate;
  const shippingPackaging = live * (n(o.packaging) + n(o.shipping)) * rate;
  const otherCosts = live * n(o.otherCosts) * rate;
  const tiktokFees =
    live *
    (n(o.referralFee) + n(o.transactionFee) + n(o.fulfillmentFee) + n(o.affiliateCommission) + n(o.otherPlatformFees)) *
    rate;
  const adCost = live * n(o.adCost) * rate;
  const treatment = o.taxTreatment ?? settings.defaultTaxTreatment;
  const taxCost = live * (treatment === "Deducted from payout" ? n(o.salesTax) : 0) * rate;

  const totalExpenses = productCost + shippingPackaging + otherCosts + tiktokFees + adCost + taxCost;
  const netProfit = revenue - totalExpenses;
  const margin = div(netProfit, revenue);
  const investment = totalExpenses;
  const roi = div(netProfit, investment);
  const profitPerUnit = live * qty === 0 ? 0 : netProfit / qty;

  const basis =
    o.status === "Cancelled"
      ? "Excluded"
      : o.status === "Returned" || o.status === "Refunded" || (o.status === "Delivered" && o.payoutStatus === "Settled")
        ? "Realized"
        : "Estimated";

  const result =
    o.status === "Cancelled"
      ? "Cancelled"
      : netProfit < 0
        ? "Loss"
        : margin < settings.lowMarginThreshold
          ? "Low margin"
          : "Profitable";

  return {
    fxRate: rate,
    fxMissing: missing,
    grossSales: round(grossSales),
    revenue: round(revenue),
    productCost: round(productCost),
    shippingPackaging: round(shippingPackaging),
    otherCosts: round(otherCosts),
    tiktokFees: round(tiktokFees),
    adCost: round(adCost),
    taxCost: round(taxCost),
    totalExpenses: round(totalExpenses),
    netProfit: round(netProfit),
    margin,
    investment: round(investment),
    roi,
    profitPerUnit: round(profitPerUnit),
    basis,
    result,
  };
}

export function withCalc(orders: Order[], settings: AppSettings): OrderWithCalc[] {
  return orders.map((o) => ({ ...o, calc: computeOrder(o, settings) }));
}

export function expenseWithCalc(expenses: Expense[], settings: AppSettings): ExpenseWithCalc[] {
  return expenses.map((e) => {
    const { rate, missing } = fxRate(e.currency, settings);
    return { ...e, fxRate: rate, fxMissing: missing, amountReporting: round(n(e.amount) * rate) };
  });
}

const inRange = (d: ISODate, start: ISODate, end: ISODate) => d >= start && d <= end;

export interface Summary {
  totalOrders: number;
  delivered: number;
  inProgress: number;
  cancelled: number;
  returned: number;
  refunded: number;
  countedOrders: number;
  revenue: number;
  productCost: number;
  tiktokFees: number;
  taxes: number;
  shippingPackaging: number;
  adCost: number;
  otherCosts: number;
  orderExpenses: number;
  grossProfit: number;
  grossMargin: number;
  businessExpenses: number;
  netProfit: number;
  netMargin: number;
  avgGrossProfitPerOrder: number;
  roi: number;
  realizedNetProfit: number;
  pendingProfit: number;
}

/**
 * Totals for a period. Gross profit = revenue minus order-level costs.
 * Net profit = gross profit minus business expenses, which are never charged to single orders.
 */
export function summarize(
  orders: OrderWithCalc[],
  expenses: ExpenseWithCalc[],
  start: ISODate,
  end: ISODate,
): Summary {
  const os = orders.filter((o) => inRange(o.orderDate, start, end));
  const es = expenses.filter((e) => inRange(e.date, start, end));
  const sum = (f: (o: OrderWithCalc) => number) => os.reduce((a, o) => a + f(o), 0);
  const count = (...s: string[]) => os.filter((o) => s.includes(o.status)).length;

  const revenue = sum((o) => o.calc.revenue);
  const orderExpenses = sum((o) => o.calc.totalExpenses);
  const grossProfit = revenue - orderExpenses;
  const businessExpenses = es.reduce((a, e) => a + e.amountReporting, 0);
  const netProfit = grossProfit - businessExpenses;
  const cancelled = count("Cancelled");
  const countedOrders = os.length - cancelled;

  return {
    totalOrders: os.length,
    delivered: count("Delivered"),
    inProgress: count("Pending", "Processing", "Shipped"),
    cancelled,
    returned: count("Returned"),
    refunded: count("Refunded"),
    countedOrders,
    revenue,
    productCost: sum((o) => o.calc.productCost),
    tiktokFees: sum((o) => o.calc.tiktokFees),
    taxes: sum((o) => o.calc.taxCost),
    shippingPackaging: sum((o) => o.calc.shippingPackaging),
    adCost: sum((o) => o.calc.adCost),
    otherCosts: sum((o) => o.calc.otherCosts),
    orderExpenses,
    grossProfit,
    grossMargin: div(grossProfit, revenue),
    businessExpenses,
    netProfit,
    netMargin: div(netProfit, revenue),
    avgGrossProfitPerOrder: div(grossProfit, countedOrders),
    roi: div(netProfit, orderExpenses + businessExpenses),
    realizedNetProfit: sum((o) => (o.calc.basis === "Realized" ? o.calc.netProfit : 0)) - businessExpenses,
    pendingProfit: sum((o) => (o.calc.basis === "Estimated" ? o.calc.netProfit : 0)),
  };
}

export interface MonthRow {
  month: ISODate;
  label: string;
  orders: number;
  revenue: number;
  productCost: number;
  tiktokFees: number;
  taxes: number;
  shippingPackaging: number;
  adCost: number;
  otherCosts: number;
  orderExpenses: number;
  grossProfit: number;
  grossMargin: number;
  businessExpenses: number;
  netProfit: number;
  netMargin: number;
  roi: number;
  changeVsPrior: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (d: ISODate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** One row per month, starting at `firstMonth` ("YYYY-MM-01"). */
export function monthlyRows(
  orders: OrderWithCalc[],
  expenses: ExpenseWithCalc[],
  firstMonth: ISODate,
  count = 12,
): MonthRow[] {
  const rows: MonthRow[] = [];
  let [y, m] = [Number(firstMonth.slice(0, 4)), Number(firstMonth.slice(5, 7))];
  for (let i = 0; i < count; i++) {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const s = summarize(orders, expenses, start, monthEnd(start));
    const prev = rows[rows.length - 1];
    rows.push({
      month: start,
      label: monthLabel(start),
      orders: s.countedOrders,
      revenue: s.revenue,
      productCost: s.productCost,
      tiktokFees: s.tiktokFees,
      taxes: s.taxes,
      shippingPackaging: s.shippingPackaging,
      adCost: s.adCost,
      otherCosts: s.otherCosts,
      orderExpenses: s.orderExpenses,
      grossProfit: s.grossProfit,
      grossMargin: s.grossMargin,
      businessExpenses: s.businessExpenses,
      netProfit: s.netProfit,
      netMargin: s.netMargin,
      roi: s.roi,
      changeVsPrior: prev ? s.netProfit - prev.netProfit : null,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return rows;
}

export interface ProductRow {
  productName: string;
  sku: string;
  units: number;
  revenue: number;
  productCost: number;
  tiktokFees: number;
  orderExpenses: number;
  profit: number;
  profitPerUnit: number;
  margin: number;
  roi: number;
  result: "Profitable" | "Low margin" | "Loss";
}

/** Totals per product and SKU, cancelled orders excluded, sorted by profit. */
export function productRows(orders: OrderWithCalc[], settings: AppSettings): ProductRow[] {
  const map = new Map<string, ProductRow>();
  for (const o of orders) {
    if (o.status === "Cancelled") continue;
    const key = `${o.productName}\u0000${o.sku}`;
    const r =
      map.get(key) ??
      ({
        productName: o.productName,
        sku: o.sku,
        units: 0,
        revenue: 0,
        productCost: 0,
        tiktokFees: 0,
        orderExpenses: 0,
        profit: 0,
        profitPerUnit: 0,
        margin: 0,
        roi: 0,
        result: "Profitable",
      } as ProductRow);
    r.units += n(o.quantity);
    r.revenue += o.calc.revenue;
    r.productCost += o.calc.productCost;
    r.tiktokFees += o.calc.tiktokFees;
    r.orderExpenses += o.calc.totalExpenses;
    r.profit += o.calc.netProfit;
    map.set(key, r);
  }
  return [...map.values()]
    .map((r) => {
      const margin = div(r.profit, r.revenue);
      return {
        ...r,
        profitPerUnit: div(r.profit, r.units),
        margin,
        roi: div(r.profit, r.orderExpenses),
        result: (r.profit < 0 ? "Loss" : margin < settings.lowMarginThreshold ? "Low margin" : "Profitable") as ProductRow["result"],
      };
    })
    .sort((a, b) => b.profit - a.profit);
}
