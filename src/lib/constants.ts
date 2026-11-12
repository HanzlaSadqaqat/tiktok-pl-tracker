export const ORDER_STATUSES = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Returned",
  "Refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYOUT_STATUSES = ["Awaiting payout", "Settled"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const TAX_TREATMENTS = ["On top of price", "Deducted from payout"] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

export const EXPENSE_CATEGORIES = [
  "Product Research Tools",
  "E-commerce Platform",
  "Software Subscriptions",
  "AI Tools",
  "Virtual Assistant / Staff",
  "Marketing",
  "Internet & Utilities",
  "Samples & Testing",
  "Bank & Payment Fees",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const BILLING_TYPES = ["One-Time", "Weekly", "Monthly", "Yearly"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const PAYMENT_STATUSES = ["Paid", "Pending"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "Credit Card",
  "Debit Card",
  "Bank Transfer",
  "PayPal",
  "Payoneer",
  "Cash",
  "Other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PERIODS = [
  "Today",
  "This Week",
  "This Month",
  "Last Month",
  "This Year",
  "All Time",
  "Custom Range",
] as const;
export type Period = (typeof PERIODS)[number];

export const CURRENCIES = [
  "USD", "GBP", "EUR", "PKR", "AED", "SAR", "CAD", "AUD",
  "MYR", "SGD", "PHP", "THB", "VND", "IDR", "MXN",
] as const;

/** Global account roles. Admins (the agency) see every client; members only the clients they are given. */
export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Agency admin",
  member: "Member",
};

/** Access a member has on one client. */
export const CLIENT_ACCESS = ["edit", "view"] as const;
export type ClientAccess = (typeof CLIENT_ACCESS)[number];
export const ACCESS_LABELS: Record<ClientAccess, string> = {
  edit: "Can add & edit",
  view: "View only",
};

/** What a page or route needs on a client. "admin" means an agency admin (client settings, people). */
export type ClientLevel = "view" | "edit" | "admin";
/** The access a user effectively has on a client. */
export type EffectiveAccess = ClientAccess | "admin";
const LEVEL_RANK: Record<ClientLevel, number> = { view: 0, edit: 1, admin: 2 };
/** True when `have` is at least `need`. */
export const meetsLevel = (have: EffectiveAccess, need: ClientLevel) => LEVEL_RANK[have] >= LEVEL_RANK[need];

export const CLIENT_STATUSES = ["Active", "Archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const MIN_PASSWORD_LENGTH = 8;

/** Cookie remembering the last client opened (its id). A preference only: access is always checked. */
export const LAST_CLIENT_COOKIE = "tt_client";
