import { describe, expect, it } from "vitest";
import { expensesFromCsv, ordersFromCsv } from "./importers";

describe("CSV importers", () => {
  it("reads an Orders tab export, skipping the example row", () => {
    const csv = [
      "ORDER INFORMATION,,,STATUS & CURRENCY",
      "Order Date,Order ID,Product Name,Product SKU,Order Status,Payout Status,Currency,Quantity,Sale Price / Unit,Buying Price / Unit,Packaging Cost,Shipping Cost,Other Order Costs,Referral / Commission Fee,Transaction Fee,Fulfillment Fee,Affiliate Commission,Advertising Cost,Other Platform Fees,Sales Tax / VAT,Tax Treatment,Refund to Buyer,Notes,FX Rate",
      "8 Nov 2026,EXAMPLE-0001,Example,LAMP-01,Delivered,Settled,USD,2,24.99,7.50,0.80,4.50,-,3.00,1.50,-,-,2.00,-,3.50,On top of price,-,Example row,1.0000",
      "9 Nov 2026,577000000000000001,Mug,MUG-1,delivered,Settled,usd,1,\"1,200.00\",5,,,,,,,,,,1,Deducted from payout,,,1",
      ",,,,,,,,,,,,,,,,,,,,,,,",
    ].join("\n");
    const { rows, errors } = ordersFromCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderDate: "2026-11-09",
      orderId: "577000000000000001",
      status: "Delivered",
      currency: "USD",
      salePrice: 1200,
      buyPrice: 5,
      salesTax: 1,
      taxTreatment: "Deducted from payout",
    });
  });

  it("reads a Business Expenses tab export", () => {
    const csv = [
      "EXPENSE DETAILS,,Log each charge",
      "Expense Date,Expense Name,Expense Category,Description,Billing Type,Amount,Currency,Payment Status,Payment Method,FX Rate,Amount (Reporting)",
      "1 Nov 2026,Kalodata Subscription,Product Research Tools,Example row. Delete before use.,Monthly,49.00,USD,Paid,Credit Card,1,49",
      "2 Nov 2026,Shopify,E-commerce Platform,,Monthly,39,USD,Pending,PayPal,1,39",
      "bad date,Thing,Other,,One-Time,5,USD,Paid,Cash,1,5",
    ].join("\n");
    const { rows, errors } = expensesFromCsv(csv);
    expect(rows).toEqual([
      { date: "2026-11-02", name: "Shopify", category: "E-commerce Platform", description: "", billingType: "Monthly", amount: 39, currency: "USD", paymentStatus: "Pending", paymentMethod: "PayPal" },
    ]);
    expect(errors).toHaveLength(1);
  });
});
