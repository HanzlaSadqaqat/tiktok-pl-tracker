import {
  BILLING_TYPES,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  TAX_TREATMENTS,
} from "./constants";
import { parseCsv, rowsToRecords, toISODate, toNumber } from "./csv";
import type { ExpenseInput, OrderInput } from "./types";

const pick = <T extends readonly string[]>(list: T, v: string | undefined, fallback: T[number]): T[number] =>
  list.find((x) => x.toLowerCase() === (v ?? "").trim().toLowerCase()) ?? fallback;

export interface ImportResult<T> {
  rows: T[];
  errors: string[];
}

/** Reads a CSV exported from the "Orders" tab of the Google Sheet (or any CSV with the same headers). */
export function ordersFromCsv(text: string): ImportResult<OrderInput> {
  const rows: OrderInput[] = [];
  const errors: string[] = [];
  rowsToRecords(parseCsv(text)).forEach((r, i) => {
    const line = i + 1;
    if (!r.orderid && !r.productname) return;
    const date = toISODate(r.orderdate);
    if (!date) return errors.push(`Row ${line}: missing or unreadable Order Date`);
    if (!r.orderid) return errors.push(`Row ${line}: missing Order ID`);
    if (/^example/i.test(r.orderid)) return;
    const tax = (r.taxtreatment ?? "").trim();
    rows.push({
      orderDate: date,
      orderId: r.orderid,
      productName: r.productname || "Unnamed product",
      sku: r.productsku ?? r.sku ?? "",
      status: pick(ORDER_STATUSES, r.orderstatus, "Pending"),
      payoutStatus: pick(PAYOUT_STATUSES, r.payoutstatus, "Awaiting payout"),
      currency: (r.currency || "USD").toUpperCase(),
      quantity: toNumber(r.quantity) || 1,
      salePrice: toNumber(r.salepriceunit),
      buyPrice: toNumber(r.buyingpriceunit),
      packaging: toNumber(r.packagingcost),
      shipping: toNumber(r.shippingcost),
      otherCosts: toNumber(r.otherordercosts),
      referralFee: toNumber(r.referralcommissionfee),
      transactionFee: toNumber(r.transactionfee),
      fulfillmentFee: toNumber(r.fulfillmentfee),
      affiliateCommission: toNumber(r.affiliatecommission),
      adCost: toNumber(r.advertisingcost),
      otherPlatformFees: toNumber(r.otherplatformfees),
      salesTax: toNumber(r.salestaxvat),
      taxTreatment: tax ? pick(TAX_TREATMENTS, tax, "On top of price") : null,
      refund: toNumber(r.refundtobuyer),
      notes: r.notes ?? "",
    });
  });
  return { rows, errors };
}

/** Reads a CSV exported from the "Business Expenses" tab. */
export function expensesFromCsv(text: string): ImportResult<ExpenseInput> {
  const rows: ExpenseInput[] = [];
  const errors: string[] = [];
  rowsToRecords(parseCsv(text)).forEach((r, i) => {
    const line = i + 1;
    if (!r.expensename) return;
    const date = toISODate(r.expensedate);
    if (!date) return errors.push(`Row ${line}: missing or unreadable Expense Date`);
    if (/example row/i.test(r.description ?? "")) return;
    rows.push({
      date,
      name: r.expensename,
      category: pick(EXPENSE_CATEGORIES, r.expensecategory, "Other"),
      description: r.description ?? "",
      billingType: pick(BILLING_TYPES, r.billingtype, "One-Time"),
      amount: toNumber(r.amount),
      currency: (r.currency || "USD").toUpperCase(),
      paymentStatus: pick(PAYMENT_STATUSES, r.paymentstatus, "Paid"),
      paymentMethod: pick(PAYMENT_METHODS, r.paymentmethod, "Other"),
    });
  });
  return { rows, errors };
}
