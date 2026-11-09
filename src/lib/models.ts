import mongoose, { Schema, type Model } from "mongoose";
import {
  BILLING_TYPES,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  TAX_TREATMENTS,
} from "./constants";
import type { AppSettings, ExpenseInput, OrderInput } from "./types";

const money = { type: Number, default: 0 };

const OrderSchema = new Schema<OrderInput>(
  {
    orderDate: { type: String, required: true, index: true },
    orderId: { type: String, required: true, unique: true, trim: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, default: "", trim: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    payoutStatus: { type: String, enum: PAYOUT_STATUSES, default: "Awaiting payout" },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    quantity: { type: Number, default: 1 },
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
    taxTreatment: { type: String, enum: [...TAX_TREATMENTS, null], default: null },
    refund: money,
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

const ExpenseSchema = new Schema<ExpenseInput>(
  {
    date: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    description: { type: String, default: "" },
    billingType: { type: String, enum: BILLING_TYPES, default: "One-Time" },
    amount: money,
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Paid" },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "Credit Card" },
  },
  { timestamps: true },
);

type SettingsDoc = Omit<AppSettings, "rates"> & { key: string; rates: Map<string, number> };

const SettingsSchema = new Schema<SettingsDoc>(
  {
    key: { type: String, default: "main", unique: true },
    reportingCurrency: { type: String, default: "USD" },
    lowMarginThreshold: { type: Number, default: 0.15 },
    defaultTaxTreatment: { type: String, enum: TAX_TREATMENTS, default: "On top of price" },
    rates: { type: Map, of: Number, default: {} },
    ratesUpdatedAt: { type: String, default: null },
  },
  { timestamps: true },
);

export const OrderModel: Model<OrderInput> =
  (mongoose.models.Order as Model<OrderInput>) ?? mongoose.model<OrderInput>("Order", OrderSchema);
export const ExpenseModel: Model<ExpenseInput> =
  (mongoose.models.Expense as Model<ExpenseInput>) ?? mongoose.model<ExpenseInput>("Expense", ExpenseSchema);
export const SettingsModel: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ?? mongoose.model<SettingsDoc>("Settings", SettingsSchema);
