import mongoose, { Schema, Types, type Model } from "mongoose";
import {
  BILLING_TYPES,
  CLIENT_ACCESS,
  CLIENT_STATUSES,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  ROLES,
  TAX_TREATMENTS,
  type ClientAccess,
  type ClientStatus,
  type Role,
} from "./constants";
import type { AppSettings, ExpenseInput, OrderInput } from "./types";

const money = { type: Number, default: 0 };
const clientRef = { type: Schema.Types.ObjectId, ref: "Client", required: true };
const userRef = { type: Schema.Types.ObjectId, ref: "User", default: null };

/** Every order, expense and settings record belongs to exactly one client. */
type Scoped<T> = T & { clientId: Types.ObjectId; createdBy?: Types.ObjectId | null; updatedBy?: Types.ObjectId | null };
export type OrderDoc = Scoped<OrderInput>;
export type ExpenseDoc = Scoped<ExpenseInput>;

// ---------------------------------------------------------------- Client

export interface ClientDoc {
  name: string;
  slug: string;
  shopName: string;
  marketplace: string;
  contactName: string;
  contactEmail: string;
  notes: string;
  status: ClientStatus;
  createdAt?: Date;
}

const ClientSchema = new Schema<ClientDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shopName: { type: String, default: "", trim: true },
    marketplace: { type: String, default: "", trim: true },
    contactName: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", trim: true, lowercase: true },
    notes: { type: String, default: "" },
    status: { type: String, enum: CLIENT_STATUSES, default: "Active", index: true },
  },
  { timestamps: true },
);

// ---------------------------------------------------------------- Orders

const OrderSchema = new Schema<OrderDoc>(
  {
    clientId: clientRef,
    orderDate: { type: String, required: true },
    // Unique per client only (see the compound index below): two clients can share an order ID.
    orderId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, default: "", trim: true },
    status: { type: String, enum: ORDER_STATUSES, required: true },
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
    createdBy: userRef,
    updatedBy: userRef,
  },
  { timestamps: true },
);
OrderSchema.index({ clientId: 1, orderId: 1 }, { unique: true });
OrderSchema.index({ clientId: 1, orderDate: -1 });

// ---------------------------------------------------------------- Business expenses

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    clientId: clientRef,
    date: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    description: { type: String, default: "" },
    billingType: { type: String, enum: BILLING_TYPES, default: "One-Time" },
    amount: money,
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Paid" },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "Credit Card" },
    createdBy: userRef,
    updatedBy: userRef,
  },
  { timestamps: true },
);
ExpenseSchema.index({ clientId: 1, date: -1 });

// ---------------------------------------------------------------- Settings (one per client)

export type SettingsDoc = Omit<AppSettings, "rates"> & { clientId: Types.ObjectId; rates: Map<string, number> };

const SettingsSchema = new Schema<SettingsDoc>(
  {
    clientId: { ...clientRef, unique: true },
    reportingCurrency: { type: String, default: "USD" },
    lowMarginThreshold: { type: Number, default: 0.15 },
    defaultTaxTreatment: { type: String, enum: TAX_TREATMENTS, default: "On top of price" },
    rates: { type: Map, of: Number, default: {} },
    ratesUpdatedAt: { type: String, default: null },
  },
  { timestamps: true },
);

// ---------------------------------------------------------------- Users and memberships

export interface UserDoc {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  /** Bumped to sign the user out everywhere (password change, reset, deactivation). */
  sessionVersion: number;
  failedLogins: number;
  /** Epoch ms until which sign-in is blocked after too many wrong passwords. */
  lockedUntil: number;
  lastLoginAt: Date | null;
  createdAt?: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: "member" },
    active: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/** A member's access to one client. Admins need no memberships: they can access every client. */
export interface MembershipDoc {
  userId: Types.ObjectId;
  clientId: Types.ObjectId;
  access: ClientAccess;
}

const MembershipSchema = new Schema<MembershipDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clientId: clientRef,
    access: { type: String, enum: CLIENT_ACCESS, required: true },
  },
  { timestamps: true },
);
MembershipSchema.index({ userId: 1, clientId: 1 }, { unique: true });
MembershipSchema.index({ clientId: 1 });

/**
 * Compiles a model once. In development, hot reload re-runs this file while Mongoose still holds the
 * previously compiled model (with the old schema), so it is replaced; otherwise schema changes would
 * be ignored until a restart (e.g. "Path clientId is not in schema").
 */
function model<T>(name: string, schema: Schema<T>): Model<T> {
  if (process.env.NODE_ENV !== "production" && mongoose.models[name]) mongoose.deleteModel(name);
  return (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);
}

export const ClientModel = model<ClientDoc>("Client", ClientSchema);
export const OrderModel = model<OrderDoc>("Order", OrderSchema);
export const ExpenseModel = model<ExpenseDoc>("Expense", ExpenseSchema);
export const SettingsModel = model<SettingsDoc>("Settings", SettingsSchema);
export const UserModel = model<UserDoc>("User", UserSchema);
export const MembershipModel = model<MembershipDoc>("Membership", MembershipSchema);
