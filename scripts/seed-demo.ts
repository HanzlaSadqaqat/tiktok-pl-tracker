/**
 * Loads a realistic 12-month demo dataset so every page, chart and filter has something to show.
 *
 *   npm run seed:demo           add the demo rows (safe to run twice, nothing is duplicated)
 *   npm run seed:demo -- --clear  remove every demo row again
 *
 * Demo orders have IDs starting with "DEMO-" and demo expenses have the description "Demo data",
 * so they never mix with real rows. The data is generated from a fixed seed, so it is the same every run.
 */
import { readFileSync, existsSync } from "node:fs";
import mongoose from "mongoose";
import type { OrderInput, ExpenseInput } from "../src/lib/types";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DEMO_TAG = "Demo data";

/** Small deterministic random generator (mulberry32), so the demo data is repeatable. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261110);
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const r2 = (n: number) => Math.round(n * 100) / 100;

// Each product has its own economics, so Product Analysis shows winners, a low-margin item and a loss-maker.
const PRODUCTS = [
  { name: "LED Desk Lamp", sku: "LAMP-01", price: 24.99, cost: 7.5, ad: [1, 3], weight: 5 },
  { name: "Silicone Kitchen Set", sku: "KIT-05", price: 32.0, cost: 9.8, ad: [2, 4], weight: 4 },
  { name: "Magnetic Phone Stand", sku: "STAND-02", price: 9.99, cost: 2.4, ad: [0.5, 1.5], weight: 6 },
  { name: "Posture Corrector", sku: "POST-11", price: 19.99, cost: 6.2, ad: [1.5, 3.5], weight: 3 },
  { name: "Mini Portable Blender", sku: "BLEND-07", price: 29.99, cost: 13.5, ad: [3, 5], weight: 3 }, // low margin
  { name: "Cloud Slides", sku: "SLIDE-03", price: 14.99, cost: 5.1, ad: [1, 2], weight: 4 },
  { name: "Car Vacuum Cleaner", sku: "VAC-09", price: 21.99, cost: 12.9, ad: [5, 8], weight: 2 }, // usually a loss
  { name: "Sunset Projector Lamp", sku: "PROJ-04", price: 17.49, cost: 4.3, ad: [1, 2.5], weight: 3 },
] as const;
const weighted = PRODUCTS.flatMap((p) => Array<(typeof PRODUCTS)[number]>(p.weight).fill(p));

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { OrderModel, ExpenseModel, SettingsModel } = await import("../src/lib/models");
  const { todayIn, addDays, addMonths, monthStart, monthEnd } = await import("../src/lib/periods");
  await connectDb();

  if (process.argv.includes("--clear")) {
    const o = await OrderModel.deleteMany({ orderId: /^DEMO-/ });
    const e = await ExpenseModel.deleteMany({ description: DEMO_TAG });
    console.log(`Removed ${o.deletedCount} demo orders and ${e.deletedCount} demo expenses.`);
    await mongoose.disconnect();
    return;
  }

  const today = todayIn(process.env.APP_TIMEZONE || "Asia/Karachi");
  const firstMonth = addMonths(monthStart(today), -11);

  // Demo rows use GBP and PKR, so make sure those rates exist (existing rates are never overwritten).
  const settings = await SettingsModel.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, returnDocument: "after" },
  );
  const fallbackRates: Record<string, number> = { GBP: 1.27, PKR: 0.0036 };
  const missing: Record<string, number> = {};
  for (const [code, rate] of Object.entries(fallbackRates)) {
    if (settings.reportingCurrency !== code && !settings.rates?.get(code)) missing[`rates.${code}`] = rate;
  }
  if (Object.keys(missing).length) await SettingsModel.updateOne({ key: "main" }, { $set: missing });

  // ---- Orders: volume grows month by month, recent orders are still in progress ----
  const orders: OrderInput[] = [];
  let seq = 1;
  for (let m = 0; m < 12; m++) {
    const start = addMonths(firstMonth, m);
    const end = monthEnd(start) < today ? monthEnd(start) : today;
    const daysInMonth = Number(end.slice(8, 10));
    const count = Math.round(8 + m * 2.2 + between(-2, 3));

    for (let i = 0; i < count; i++) {
      const p = pick(weighted);
      const orderDate = addDays(start, Math.floor(rand() * daysInMonth));
      const ageDays = (Date.parse(today) - Date.parse(orderDate)) / 86400000;
      const gbp = rand() < 0.12;
      const fx = gbp ? 0.79 : 1; // GBP prices are roughly the USD price converted
      const quantity = rand() < 0.75 ? 1 : rand() < 0.8 ? 2 : 3;
      const salePrice = r2(p.price * fx * between(0.95, 1.05));
      const buyPrice = r2(p.cost * fx);
      const gross = quantity * salePrice;

      // Status depends on how old the order is.
      let status: OrderInput["status"];
      let payoutStatus: OrderInput["payoutStatus"] = "Settled";
      const roll = rand();
      if (roll < 0.05) status = "Cancelled";
      else if (roll < 0.09) status = "Returned";
      else if (roll < 0.11) status = "Refunded";
      else if (ageDays < 2) status = pick(["Pending", "Processing"]);
      else if (ageDays < 6) status = pick(["Processing", "Shipped", "Shipped"]);
      else if (ageDays < 15) status = pick(["Shipped", "Delivered", "Delivered"]);
      else status = "Delivered";
      if (["Pending", "Processing", "Shipped", "Cancelled"].includes(status)) payoutStatus = "Awaiting payout";
      if (status === "Delivered" && ageDays < 15) payoutStatus = "Awaiting payout";

      const hasAffiliate = rand() < 0.4;
      const deducted = rand() < 0.15;
      const cancelled = status === "Cancelled";
      orders.push({
        orderDate,
        orderId: `DEMO-${String(576000000000 + seq++ * 7919)}`,
        productName: p.name,
        sku: p.sku,
        status,
        payoutStatus,
        currency: gbp ? "GBP" : "USD",
        quantity,
        salePrice,
        buyPrice,
        packaging: r2(between(0.5, 1.2) * fx),
        shipping: r2(between(3.5, 5.5) * fx),
        otherCosts: rand() < 0.1 ? r2(between(0.5, 2)) : 0,
        referralFee: cancelled ? 0 : r2(gross * 0.06),
        transactionFee: cancelled ? 0 : r2(0.3 * fx + gross * 0.029),
        fulfillmentFee: rand() < 0.2 ? r2(between(2, 3.5) * fx) : 0,
        affiliateCommission: hasAffiliate && !cancelled ? r2(gross * between(0.1, 0.15)) : 0,
        adCost: cancelled ? 0 : r2(between(p.ad[0], p.ad[1]) * fx),
        otherPlatformFees: 0,
        salesTax: r2(gross * 0.08),
        taxTreatment: deducted ? ("Deducted from payout" as const) : null,
        refund: status === "Refunded" || status === "Returned" ? r2(gross) : 0,
        notes: status === "Returned" ? `${DEMO_TAG} - buyer returned item` : DEMO_TAG,
      });
    }
  }

  // ---- Business expenses: one row per charge, on the date it was billed ----
  const expenses: ExpenseInput[] = [];
  const add = (date: string, name: string, category: ExpenseInput["category"], billingType: ExpenseInput["billingType"], amount: number, extra: Partial<ExpenseInput> = {}) => {
    if (date > today) return;
    expenses.push({ date, name, category, description: DEMO_TAG, billingType, amount, currency: "USD", paymentStatus: "Paid", paymentMethod: "Credit Card", ...extra });
  };
  for (let m = 0; m < 12; m++) {
    const month = addMonths(firstMonth, m);
    const isCurrent = month === monthStart(today);
    add(addDays(month, 2), "Kalodata Subscription", "Product Research Tools", "Monthly", 49);
    add(addDays(month, 4), "Shopify Basic", "E-commerce Platform", "Monthly", 39);
    add(addDays(month, 6), "ChatGPT Plus", "AI Tools", "Monthly", 20);
    add(addDays(month, 9), "Internet Bill", "Internet & Utilities", "Monthly", 6500, { currency: "PKR", paymentMethod: "Bank Transfer" });
    add(addDays(month, 27), "Virtual Assistant", "Virtual Assistant / Staff", "Monthly", m < 5 ? 250 : 350, {
      paymentMethod: "Payoneer",
      paymentStatus: isCurrent ? "Pending" : "Paid",
    });
    if (m % 3 === 1) add(addDays(month, 14), "Product Samples", "Samples & Testing", "One-Time", r2(between(35, 90)), { paymentMethod: "PayPal" });
    if (m % 4 === 2) add(addDays(month, 18), "Creator Outreach Campaign", "Marketing", "One-Time", r2(between(60, 150)), { paymentMethod: "Debit Card" });
    for (let w = 0; w < 4; w++) add(addDays(month, 1 + w * 7), "Payoneer Withdrawal Fee", "Bank & Payment Fees", "Weekly", 3, { paymentMethod: "Payoneer" });
  }
  add(addDays(firstMonth, 20), "Canva Pro (yearly)", "Software Subscriptions", "Yearly", 119.99);
  add(addDays(firstMonth, 45), "CapCut Pro (yearly)", "Software Subscriptions", "Yearly", 89.99, { currency: "GBP" });
  add(addDays(today, -1), "Office Chair", "Other", "One-Time", 45000, { currency: "PKR", paymentMethod: "Cash", paymentStatus: "Pending" });

  // ---- Write (upserts, so running twice adds nothing) ----
  const oRes = await OrderModel.bulkWrite(
    orders.map((o) => ({ updateOne: { filter: { orderId: o.orderId }, update: { $setOnInsert: o }, upsert: true } })),
  );
  const eRes = await ExpenseModel.bulkWrite(
    expenses.map((e) => ({
      updateOne: { filter: { date: e.date, name: e.name, amount: e.amount, description: DEMO_TAG }, update: { $setOnInsert: e }, upsert: true },
    })),
  );

  console.log(`Demo period: ${firstMonth} to ${today}`);
  console.log(`Orders:   ${oRes.upsertedCount} added, ${orders.length - oRes.upsertedCount} already there`);
  console.log(`Expenses: ${eRes.upsertedCount} added, ${expenses.length - eRes.upsertedCount} already there`);
  if (Object.keys(missing).length) console.log(`Added exchange rates: ${Object.keys(missing).map((k) => k.slice(6)).join(", ")}`);
  console.log(`Remove it again with: npm run seed:demo -- --clear`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
