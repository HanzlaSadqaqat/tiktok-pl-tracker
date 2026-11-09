/**
 * Adds a few example orders and expenses so you can see the dashboard working.
 * Usage: npm run seed   (reads MONGODB_URI from .env.local or the environment)
 * Delete the rows afterwards from the Orders and Business Expenses pages.
 */
import { readFileSync, existsSync } from "node:fs";
import mongoose from "mongoose";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { OrderModel, ExpenseModel } = await import("../src/lib/models");
  await connectDb();

  const today = new Date();
  const iso = (daysAgo: number) => new Date(today.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
  const base = {
    payoutStatus: "Settled", currency: "USD", packaging: 0.8, shipping: 4.5, otherCosts: 0, transactionFee: 1.5,
    fulfillmentFee: 0, affiliateCommission: 0, otherPlatformFees: 0, salesTax: 0, taxTreatment: null, refund: 0, notes: "Example",
  };
  const orders = [
    { ...base, orderDate: iso(2), orderId: "EXAMPLE-1001", productName: "LED Desk Lamp", sku: "LAMP-01", status: "Delivered", quantity: 2, salePrice: 24.99, buyPrice: 7.5, referralFee: 3, adCost: 2 },
    { ...base, orderDate: iso(5), orderId: "EXAMPLE-1002", productName: "Silicone Kitchen Set", sku: "KIT-05", status: "Delivered", quantity: 1, salePrice: 32, buyPrice: 9.8, referralFee: 1.92, adCost: 3.5, affiliateCommission: 3.2 },
    { ...base, orderDate: iso(9), orderId: "EXAMPLE-1003", productName: "Phone Stand", sku: "STAND-02", status: "Shipped", payoutStatus: "Awaiting payout", quantity: 3, salePrice: 9.99, buyPrice: 2.4, referralFee: 1.8, adCost: 4 },
    { ...base, orderDate: iso(14), orderId: "EXAMPLE-1004", productName: "Phone Stand", sku: "STAND-02", status: "Returned", quantity: 1, salePrice: 9.99, buyPrice: 2.4, referralFee: 0.6, adCost: 1.5, refund: 9.99 },
    { ...base, orderDate: iso(35), orderId: "EXAMPLE-1005", productName: "LED Desk Lamp", sku: "LAMP-01", status: "Delivered", quantity: 1, salePrice: 24.99, buyPrice: 7.5, referralFee: 1.5, adCost: 2.5 },
    { ...base, orderDate: iso(40), orderId: "EXAMPLE-1006", productName: "Silicone Kitchen Set", sku: "KIT-05", status: "Cancelled", quantity: 1, salePrice: 32, buyPrice: 9.8, referralFee: 0, adCost: 0 },
  ];
  const expenses = [
    { date: iso(3), name: "Kalodata Subscription", category: "Product Research Tools", description: "Example", billingType: "Monthly", amount: 49, currency: "USD", paymentStatus: "Paid", paymentMethod: "Credit Card" },
    { date: iso(33), name: "Kalodata Subscription", category: "Product Research Tools", description: "Example", billingType: "Monthly", amount: 49, currency: "USD", paymentStatus: "Paid", paymentMethod: "Credit Card" },
    { date: iso(6), name: "ChatGPT Plus", category: "AI Tools", description: "Example", billingType: "Monthly", amount: 20, currency: "USD", paymentStatus: "Paid", paymentMethod: "Credit Card" },
  ];

  let added = 0;
  for (const o of orders) {
    const res = await OrderModel.updateOne({ orderId: o.orderId }, { $setOnInsert: o }, { upsert: true });
    added += res.upsertedCount;
  }
  for (const e of expenses) {
    const res = await ExpenseModel.updateOne({ date: e.date, name: e.name, amount: e.amount }, { $setOnInsert: e }, { upsert: true });
    added += res.upsertedCount;
  }
  console.log(`Added ${added} example rows.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
