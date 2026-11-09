import type {
  BillingType,
  ExpenseCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PayoutStatus,
  TaxTreatment,
} from "./constants";

/** Dates are stored as "YYYY-MM-DD" strings so comparisons never shift with time zones. */
export type ISODate = string;

export interface Order {
  id: string;
  orderDate: ISODate;
  orderId: string;
  productName: string;
  sku: string;
  status: OrderStatus;
  payoutStatus: PayoutStatus;
  currency: string;
  quantity: number;
  salePrice: number;
  buyPrice: number;
  packaging: number;
  shipping: number;
  otherCosts: number;
  referralFee: number;
  transactionFee: number;
  fulfillmentFee: number;
  affiliateCommission: number;
  adCost: number;
  otherPlatformFees: number;
  salesTax: number;
  /** null means "use the default from Settings". */
  taxTreatment: TaxTreatment | null;
  refund: number;
  notes: string;
}

export type OrderInput = Omit<Order, "id">;

export interface Expense {
  id: string;
  date: ISODate;
  name: string;
  category: ExpenseCategory;
  description: string;
  billingType: BillingType;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
}

export type ExpenseInput = Omit<Expense, "id">;

export interface AppSettings {
  reportingCurrency: string;
  /** Fraction, e.g. 0.15 for 15%. */
  lowMarginThreshold: number;
  defaultTaxTreatment: TaxTreatment;
  /** Value of 1 unit of each currency in the reporting currency. */
  rates: Record<string, number>;
  ratesUpdatedAt: string | null;
}

export type ProfitBasis = "Realized" | "Estimated" | "Excluded";
export type OrderResult = "Profitable" | "Low margin" | "Loss" | "Cancelled";

export interface OrderCalc {
  fxRate: number;
  fxMissing: boolean;
  grossSales: number;
  revenue: number;
  productCost: number;
  shippingPackaging: number;
  otherCosts: number;
  tiktokFees: number;
  adCost: number;
  taxCost: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
  investment: number;
  roi: number;
  profitPerUnit: number;
  basis: ProfitBasis;
  result: OrderResult;
}

export type OrderWithCalc = Order & { calc: OrderCalc };
export type ExpenseWithCalc = Expense & { fxRate: number; fxMissing: boolean; amountReporting: number };
