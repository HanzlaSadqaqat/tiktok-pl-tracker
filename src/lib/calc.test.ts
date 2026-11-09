import { describe, expect, it } from "vitest";
import { computeOrder, expenseWithCalc, monthlyRows, productRows, summarize, withCalc } from "./calc";
import type { AppSettings, Expense, Order } from "./types";

const settings: AppSettings = {
  reportingCurrency: "USD",
  lowMarginThreshold: 0.15,
  defaultTaxTreatment: "On top of price",
  rates: { PKR: 0.0036, GBP: 1.3 },
  ratesUpdatedAt: null,
};

const base: Order = {
  id: "1",
  orderDate: "2026-11-08",
  orderId: "A1",
  productName: "LED Desk Lamp",
  sku: "LAMP-01",
  status: "Delivered",
  payoutStatus: "Settled",
  currency: "USD",
  quantity: 2,
  salePrice: 24.99,
  buyPrice: 7.5,
  packaging: 0.8,
  shipping: 4.5,
  otherCosts: 0,
  referralFee: 3,
  transactionFee: 1.5,
  fulfillmentFee: 0,
  affiliateCommission: 0,
  adCost: 2,
  otherPlatformFees: 0,
  salesTax: 3.5,
  taxTreatment: null,
  refund: 0,
  notes: "",
};

const kalodata: Expense = {
  id: "e1",
  date: "2026-11-01",
  name: "Kalodata",
  category: "Product Research Tools",
  description: "",
  billingType: "Monthly",
  amount: 49,
  currency: "USD",
  paymentStatus: "Paid",
  paymentMethod: "Credit Card",
};

describe("computeOrder", () => {
  it("matches the Google Sheet example row", () => {
    const c = computeOrder(base, settings);
    expect(c.revenue).toBeCloseTo(49.98);
    expect(c.productCost).toBeCloseTo(15);
    expect(c.shippingPackaging).toBeCloseTo(5.3);
    expect(c.tiktokFees).toBeCloseTo(4.5);
    expect(c.taxCost).toBe(0);
    expect(c.totalExpenses).toBeCloseTo(26.8);
    expect(c.netProfit).toBeCloseTo(23.18);
    expect(c.margin).toBeCloseTo(0.4638, 4);
    expect(c.roi).toBeCloseTo(0.8649, 4);
    expect(c.profitPerUnit).toBeCloseTo(11.59);
    expect(c.basis).toBe("Realized");
    expect(c.result).toBe("Profitable");
  });

  it("counts sales tax only when it is deducted from the payout", () => {
    expect(computeOrder({ ...base, taxTreatment: "Deducted from payout" }, settings).taxCost).toBeCloseTo(3.5);
    const s2 = { ...settings, defaultTaxTreatment: "Deducted from payout" as const };
    expect(computeOrder(base, s2).taxCost).toBeCloseTo(3.5);
    expect(computeOrder({ ...base, taxTreatment: "On top of price" }, s2).taxCost).toBe(0);
  });

  it("zeroes cancelled orders and excludes them", () => {
    const c = computeOrder({ ...base, status: "Cancelled" }, settings);
    expect(c.revenue).toBe(0);
    expect(c.totalExpenses).toBe(0);
    expect(c.netProfit).toBe(0);
    expect(c.basis).toBe("Excluded");
    expect(c.result).toBe("Cancelled");
  });

  it("subtracts refunds from revenue and keeps product cost for returns", () => {
    const c = computeOrder({ ...base, status: "Returned", refund: 49.98 }, settings);
    expect(c.revenue).toBeCloseTo(0);
    expect(c.netProfit).toBeCloseTo(-26.8);
    expect(c.margin).toBe(0);
    expect(c.basis).toBe("Realized");
    expect(c.result).toBe("Loss");
  });

  it("marks delivered orders awaiting payout as estimated", () => {
    expect(computeOrder({ ...base, payoutStatus: "Awaiting payout" }, settings).basis).toBe("Estimated");
    expect(computeOrder({ ...base, status: "Shipped" }, settings).basis).toBe("Estimated");
  });

  it("flags low margins", () => {
    expect(computeOrder({ ...base, salePrice: 14 }, settings).result).toBe("Low margin");
  });

  it("converts other currencies and flags missing rates", () => {
    const c = computeOrder({ ...base, currency: "PKR", quantity: 1, salePrice: 10000, buyPrice: 0, packaging: 0, shipping: 0, referralFee: 0, transactionFee: 0, adCost: 0 }, settings);
    expect(c.revenue).toBeCloseTo(36);
    expect(c.fxMissing).toBe(false);
    expect(computeOrder({ ...base, currency: "JPY" }, settings).fxMissing).toBe(true);
  });

  it("handles empty numbers without NaN", () => {
    const c = computeOrder({ ...base, quantity: 0, salePrice: NaN }, settings);
    expect(c.netProfit).not.toBeNaN();
    expect(c.margin).toBe(0);
    expect(c.profitPerUnit).toBe(0);
  });
});

describe("summarize", () => {
  it("keeps business expenses out of gross profit and in net profit", () => {
    const orders = withCalc([base, { ...base, id: "2", status: "Cancelled" }], settings);
    const expenses = expenseWithCalc([kalodata], settings);
    const s = summarize(orders, expenses, "2026-11-01", "2026-11-30");
    expect(s.totalOrders).toBe(2);
    expect(s.cancelled).toBe(1);
    expect(s.countedOrders).toBe(1);
    expect(s.grossProfit).toBeCloseTo(23.18);
    expect(s.businessExpenses).toBe(49);
    expect(s.netProfit).toBeCloseTo(-25.82);
    expect(s.roi).toBeCloseTo(-25.82 / (26.8 + 49), 6);
    expect(s.realizedNetProfit).toBeCloseTo(-25.82);
  });

  it("filters by date range", () => {
    const orders = withCalc([base], settings);
    expect(summarize(orders, [], "2026-10-01", "2026-10-31").totalOrders).toBe(0);
  });
});

describe("monthlyRows and productRows", () => {
  it("builds 12 months with change vs prior month", () => {
    const rows = monthlyRows(withCalc([base], settings), expenseWithCalc([kalodata], settings), "2026-01-01");
    expect(rows).toHaveLength(12);
    expect(rows[10].netProfit).toBeCloseTo(-25.82);
    expect(rows[11].changeVsPrior).toBeCloseTo(25.82);
    expect(rows[0].changeVsPrior).toBeNull();
  });

  it("groups by product and sorts by profit", () => {
    const orders = withCalc(
      [base, { ...base, id: "2", productName: "Mug", sku: "MUG", salePrice: 5 }, { ...base, id: "3" }],
      settings,
    );
    const rows = productRows(orders, settings);
    expect(rows[0].productName).toBe("LED Desk Lamp");
    expect(rows[0].units).toBe(4);
    expect(rows[1].result).toBe("Loss");
  });
});
