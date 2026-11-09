import { z } from "zod";
import {
  BILLING_TYPES,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  TAX_TREATMENTS,
} from "./constants";
import { isISODate } from "./periods";

const date = z.string().refine(isISODate, "Use a valid date (YYYY-MM-DD)");
const money = z.coerce.number().finite().default(0);
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").default("USD");

export const orderSchema = z.object({
  orderDate: date,
  orderId: z.string().trim().min(1, "Order ID is required").max(100),
  productName: z.string().trim().min(1, "Product name is required").max(200),
  sku: z.string().trim().max(100).default(""),
  status: z.enum(ORDER_STATUSES),
  payoutStatus: z.enum(PAYOUT_STATUSES).default("Awaiting payout"),
  currency,
  quantity: z.coerce.number().finite().min(0).default(1),
  salePrice: money,
  buyPrice: money,
  packaging: money,
  shipping: money,
  otherCosts: money,
  referralFee: money,
  transactionFee: money,
  fulfillmentFee: money,
  affiliateCommission: money,
  adCost: money,
  otherPlatformFees: money,
  salesTax: money,
  taxTreatment: z.enum(TAX_TREATMENTS).nullable().default(null),
  refund: money,
  notes: z.string().max(2000).default(""),
});

export const expenseSchema = z.object({
  date,
  name: z.string().trim().min(1, "Expense name is required").max(200),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().max(2000).default(""),
  billingType: z.enum(BILLING_TYPES).default("One-Time"),
  amount: money,
  currency,
  paymentStatus: z.enum(PAYMENT_STATUSES).default("Paid"),
  paymentMethod: z.enum(PAYMENT_METHODS).default("Credit Card"),
});

export const settingsSchema = z.object({
  reportingCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  lowMarginThreshold: z.coerce.number().min(0).max(1),
  defaultTaxTreatment: z.enum(TAX_TREATMENTS),
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), z.coerce.number().positive()),
});

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}
