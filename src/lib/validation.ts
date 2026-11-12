import { z } from "zod";
import {
  BILLING_TYPES,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  CLIENT_ACCESS,
  CLIENT_STATUSES,
  MIN_PASSWORD_LENGTH,
  ROLES,
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

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(200));
const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200, "Password is too long");
const personName = z.string().trim().min(1, "Name is required").max(80, "Name is too long");

export const loginSchema = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Unknown id");
const access = z.enum(CLIENT_ACCESS);
const memberships = z.array(z.object({ clientId: objectId, access })).max(500);

export const createUserSchema = z.object({
  name: personName,
  email,
  password: newPassword,
  role: z.enum(ROLES),
  memberships: memberships.default([]),
});

export const updateUserSchema = z
  .object({ name: personName, email, role: z.enum(ROLES), active: z.boolean(), password: newPassword, memberships })
  .partial();

// ---------------------------------------------------------------- Clients

const optionalText = (max: number) => z.string().trim().max(max, "Too long").default("");
export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(100, "Name is too long"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60, "Web address is too long")
    .regex(/^[a-z0-9-]*$/, "Web address can only use letters, numbers and dashes")
    .default(""),
  shopName: optionalText(100),
  marketplace: optionalText(40),
  contactName: optionalText(80),
  contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid contact email"))]).default(""),
  notes: optionalText(2000),
});

export const createClientSchema = clientSchema.extend({
  reportingCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").default("USD"),
});

export const updateClientSchema = clientSchema.partial().extend({ status: z.enum(CLIENT_STATUSES).optional() });

export const deleteClientSchema = z.object({ confirmName: z.string().max(200) });

export const addPersonSchema = z.union([
  z.object({ userId: objectId, access }),
  z.object({ name: personName, email, password: newPassword, access }),
]);

export const setAccessSchema = z.object({ access });

export const changePasswordSchema = z.object({ currentPassword: z.string().max(200), newPassword });
