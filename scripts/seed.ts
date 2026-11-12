/**
 * Adds a few example orders and expenses to one client so you can see the dashboard working.
 *
 *   npm run seed -- my-shop      (the client's web address, as in /c/my-shop)
 *
 * Delete the rows afterwards from that client's Orders and Business Expenses pages.
 */
import "./load-env";
import mongoose from "mongoose";

async function main() {
  const slug = process.argv[2]?.trim().toLowerCase();
  if (!slug) {
    console.error("Usage: npm run seed -- <client-web-address>   e.g. npm run seed -- my-shop");
    process.exit(1);
  }
  const { connectDb } = await import("../src/lib/db");
  const { ClientModel, OrderModel, ExpenseModel } = await import("../src/lib/models");
  await connectDb();
  const client = await ClientModel.findOne({ slug }).lean();
  if (!client) {
    const all = await ClientModel.find({}, { slug: 1 }).lean();
    console.error(`No client with the web address "${slug}". Clients: ${all.map((c) => c.slug).join(", ") || "none (run npm run migrate:clients)"}`);
    process.exit(1);
  }
  const clientId = client._id;

  const today = new Date();
  const iso = (daysAgo: number) => new Date(today.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
  const base = {
    clientId, payoutStatus: "Settled", currency: "USD", packaging: 0.8, shipping: 4.5, otherCosts: 0, transactionFee: 1.5,
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
  const expense = { clientId, category: "Product Research Tools", description: "Example", billingType: "Monthly", currency: "USD", paymentStatus: "Paid", paymentMethod: "Credit Card" };
  const expenses = [
    { ...expense, date: iso(3), name: "Kalodata Subscription", amount: 49 },
    { ...expense, date: iso(33), name: "Kalodata Subscription", amount: 49 },
    { ...expense, date: iso(6), name: "ChatGPT Plus", category: "AI Tools", amount: 20 },
  ];

  let added = 0;
  for (const o of orders) {
    const res = await OrderModel.updateOne({ clientId, orderId: o.orderId }, { $setOnInsert: o }, { upsert: true });
    added += res.upsertedCount;
  }
  for (const e of expenses) {
    const res = await ExpenseModel.updateOne({ clientId, date: e.date, name: e.name, amount: e.amount }, { $setOnInsert: e }, { upsert: true });
    added += res.upsertedCount;
  }
  console.log(`Added ${added} example rows to "${client.name}".`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
