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
