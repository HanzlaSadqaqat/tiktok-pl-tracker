/**
 * Client isolation and access levels, tested through the real API route handlers
 * against an in-memory MongoDB. Only the session cookie is faked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "tt_session" && cookie.value ? { value: cookie.value } : undefined) }),
}));

import * as clientRoute from "@/app/api/clients/[clientId]/route";
import * as clientsRoute from "@/app/api/clients/route";
import * as expenseIdRoute from "@/app/api/clients/[clientId]/expenses/[id]/route";
import * as expenseImportRoute from "@/app/api/clients/[clientId]/expenses/import/route";
import * as expensesRoute from "@/app/api/clients/[clientId]/expenses/route";
import * as orderIdRoute from "@/app/api/clients/[clientId]/orders/[id]/route";
import * as orderImportRoute from "@/app/api/clients/[clientId]/orders/import/route";
import * as ordersRoute from "@/app/api/clients/[clientId]/orders/route";
import * as peopleRoute from "@/app/api/clients/[clientId]/people/route";
import * as settingsRoute from "@/app/api/clients/[clientId]/settings/route";
import { buildIndexes, resetDb, startDb, stopDb } from "@/test/mongo";
import { createSessionToken } from "./auth";
import { summarize } from "./calc";
import { createClient, removeMembership, setMembership, updateClient } from "./clients";
import { loadAll, loadOverview } from "./data";
import { OrderModel } from "./models";
import { createExpense, createOrder } from "./repo";
import type { Client, ExpenseInput, OrderInput } from "./types";
import { createUser } from "./users";

process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function call(handler: unknown, params: Record<string, string>, init: { method?: string; body?: unknown; query?: string } = {}) {
  const req = new Request(`http://test.local/api${init.query ?? ""}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(params) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

interface Who { id: string }
const as = async (u: Who | null) => {
  cookie.value = u ? await createSessionToken(u.id, 0) : undefined;
};

const order = (orderId: string, extra: Partial<OrderInput> = {}): OrderInput => ({
  orderDate: "2026-11-08", orderId, productName: "Desk Lamp", status: "Delivered", payoutStatus: "Settled",
  currency: "USD", quantity: 2, salePrice: 24.99, buyPrice: 7.5, packaging: 0.8, shipping: 4.5,
  referralFee: 3, transactionFee: 1.5, adCost: 2, salesTax: 3.5, taxTreatment: null, refund: 0,
  sku: "", otherCosts: 0, fulfillmentFee: 0, affiliateCommission: 0, otherPlatformFees: 0, notes: "", ...extra,
});
const expense = (name: string, amount: number): ExpenseInput => ({
  date: "2026-11-03", name, category: "Product Research Tools", billingType: "Monthly", amount, currency: "USD", paymentStatus: "Paid", paymentMethod: "Credit Card", description: "",
});
const ORDERS_CSV = "Order Date,Order ID,Product Name,Order Status,Quantity,Sale Price / Unit\n2026-11-01,CSV-1,Mug,Delivered,1,10\n";
const EXPENSES_CSV = "Expense Date,Expense Name,Expense Category,Amount\n2026-11-01,Canva,Software Subscriptions,12\n";

let A: Client, B: Client;
let admin: Who, editorA: Who, viewerA: Who, outsider: Who;
let orderA: string, orderB: string, expenseB: string;

beforeAll(async () => {
  await startDb();
  await buildIndexes();
});
afterAll(stopDb);

beforeEach(async () => {
  await resetDb();
  await buildIndexes();
  A = await createClient({ name: "Ali's Home Store", slug: "", shopName: "", marketplace: "US", contactName: "", contactEmail: "", notes: "" });
  B = await createClient({ name: "Bella Beauty", slug: "", shopName: "", marketplace: "UK", contactName: "", contactEmail: "", notes: "" }, { reportingCurrency: "GBP" });
  admin = await createUser({ name: "Admin", email: "admin@test.local", password: "admin-pass-1", role: "admin" });
  editorA = await createUser({ name: "Ed", email: "ed@test.local", password: "ed-pass-123", role: "member", memberships: [{ clientId: A.id, access: "edit" }] });
  viewerA = await createUser({ name: "Vi", email: "vi@test.local", password: "vi-pass-123", role: "member", memberships: [{ clientId: A.id, access: "view" }] });
  outsider = await createUser({ name: "Out", email: "out@test.local", password: "out-pass-12", role: "member" });
  orderA = (await createOrder(A.id, admin.id, order("A-1"))).id;
  orderB = (await createOrder(B.id, admin.id, order("B-1"))).id;
  expenseB = (await createExpense(B.id, admin.id, expense("Shopify", 39))).id;
  await createExpense(A.id, admin.id, expense("Kalodata", 49));
});

describe("client isolation: a member of client A gets 404 on client B", () => {
  it("cannot read B's orders, expenses, settings or details", async () => {
    await as(editorA);
    for (const id of [B.id, B.slug]) {
      expect((await call(ordersRoute.GET, { clientId: id })).status).toBe(404);
      expect((await call(expensesRoute.GET, { clientId: id })).status).toBe(404);
      expect((await call(settingsRoute.GET, { clientId: id })).status).toBe(404);
      expect((await call(clientRoute.GET, { clientId: id })).status).toBe(404);
    }
  });

  it("gets the same 404 for B as for a client that does not exist (no name discovery)", async () => {
    await as(editorA);
    const real = await call(ordersRoute.GET, { clientId: B.id });
    const fake = await call(ordersRoute.GET, { clientId: "0123456789abcdef01234567" });
    expect(real).toEqual(fake);
  });

  it("cannot create, edit, delete or import into B", async () => {
    await as(editorA);
    expect((await call(ordersRoute.POST, { clientId: B.id }, { method: "POST", body: order("X-1") })).status).toBe(404);
    expect((await call(orderIdRoute.PUT, { clientId: B.id, id: orderB }, { method: "PUT", body: order("B-1", { salePrice: 1 }) })).status).toBe(404);
    expect((await call(orderIdRoute.DELETE, { clientId: B.id, id: orderB }, { method: "DELETE" })).status).toBe(404);
    expect((await call(orderImportRoute.POST, { clientId: B.id }, { method: "POST", body: { csv: ORDERS_CSV } })).status).toBe(404);
    expect((await call(expensesRoute.POST, { clientId: B.id }, { method: "POST", body: expense("X", 1) })).status).toBe(404);
    expect((await call(expenseIdRoute.PUT, { clientId: B.id, id: expenseB }, { method: "PUT", body: expense("X", 1) })).status).toBe(404);
    expect((await call(expenseIdRoute.DELETE, { clientId: B.id, id: expenseB }, { method: "DELETE" })).status).toBe(404);
    expect((await call(expenseImportRoute.POST, { clientId: B.id }, { method: "POST", body: { csv: EXPENSES_CSV } })).status).toBe(404);
    expect((await call(settingsRoute.PUT, { clientId: B.id }, { method: "PUT", body: { lowMarginThreshold: 0.5 } })).status).toBe(404);
    expect(await OrderModel.countDocuments({ clientId: B.id })).toBe(1);
  });

  it("cannot touch B's order or expense through A's URL by passing B's id", async () => {
    await as(editorA);
    expect((await call(orderIdRoute.PUT, { clientId: A.id, id: orderB }, { method: "PUT", body: order("B-1", { salePrice: 1 }) })).status).toBe(404);
    expect((await call(orderIdRoute.DELETE, { clientId: A.id, id: orderB }, { method: "DELETE" })).status).toBe(404);
    expect((await call(expenseIdRoute.PUT, { clientId: A.id, id: expenseB }, { method: "PUT", body: expense("X", 1) })).status).toBe(404);
    expect((await call(expenseIdRoute.DELETE, { clientId: A.id, id: expenseB }, { method: "DELETE" })).status).toBe(404);
    const b = await OrderModel.findById(orderB).lean();
    expect(b?.salePrice).toBe(24.99);
    expect(String(b?.clientId)).toBe(B.id);
  });

  it("only sees its own clients in the client list", async () => {
    await as(editorA);
    const r = await call(clientsRoute.GET, {});
    expect(r.json.clients.map((c: Client) => c.id)).toEqual([A.id]);
    await as(outsider);
    expect((await call(clientsRoute.GET, {})).json.clients).toEqual([]);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(404);
  });

  it("returns only the client's own rows", async () => {
    await as(admin);
    const a = await call(ordersRoute.GET, { clientId: A.id });
    expect(a.json.orders.map((o: { orderId: string }) => o.orderId)).toEqual(["A-1"]);
    expect(a.json.orders[0]).not.toHaveProperty("clientId");
  });
});

describe("access levels on a client", () => {
  it("edit members can add, edit, delete and import; view members can only read", async () => {
    await as(editorA);
    const created = await call(ordersRoute.POST, { clientId: A.id }, { method: "POST", body: order("A-2") });
    expect(created.status).toBe(201);
    expect((await call(orderIdRoute.PUT, { clientId: A.id, id: created.json.order.id }, { method: "PUT", body: order("A-2", { quantity: 3 }) })).status).toBe(200);
    expect((await call(orderImportRoute.POST, { clientId: A.id }, { method: "POST", body: { csv: ORDERS_CSV } })).json.inserted).toBe(1);
    expect((await call(orderIdRoute.DELETE, { clientId: A.id, id: created.json.order.id }, { method: "DELETE" })).status).toBe(200);
    const saved = await OrderModel.findOne({ clientId: A.id, orderId: "CSV-1" }).lean();
    expect(String(saved?.createdBy)).toBe(editorA.id);

    await as(viewerA);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(200);
    expect((await call(ordersRoute.POST, { clientId: A.id }, { method: "POST", body: order("A-3") })).status).toBe(403);
    expect((await call(orderIdRoute.DELETE, { clientId: A.id, id: orderA }, { method: "DELETE" })).status).toBe(403);
    expect((await call(expenseImportRoute.POST, { clientId: A.id }, { method: "POST", body: { csv: EXPENSES_CSV } })).status).toBe(403);
  });

  it("settings, exchange rates and people are for agency admins only", async () => {
    for (const u of [editorA, viewerA]) {
      await as(u);
      expect((await call(settingsRoute.GET, { clientId: A.id })).status).toBe(200);
      expect((await call(settingsRoute.PUT, { clientId: A.id }, { method: "PUT", body: { lowMarginThreshold: 0.5 } })).status).toBe(403);
      expect((await call(peopleRoute.GET, { clientId: A.id })).status).toBe(403);
      expect((await call(clientRoute.PUT, { clientId: A.id }, { method: "PUT", body: { name: "Hacked" } })).status).toBe(403);
    }
    await as(admin);
    const full = { reportingCurrency: "USD", lowMarginThreshold: 0.2, defaultTaxTreatment: "On top of price", rates: {}, ratesUpdatedAt: null };
    const saved = await call(settingsRoute.PUT, { clientId: A.id }, { method: "PUT", body: full });
    expect(saved.status).toBe(200);
    expect(saved.json.settings.lowMarginThreshold).toBe(0.2);
    expect((await call(settingsRoute.GET, { clientId: B.id })).json.settings.lowMarginThreshold).toBe(0.15); // B untouched
    expect((await call(settingsRoute.GET, { clientId: B.id })).json.settings.reportingCurrency).toBe("GBP");
  });

  it("only admins create clients", async () => {
    await as(editorA);
    expect((await call(clientsRoute.POST, {}, { method: "POST", body: { name: "Mine" } })).status).toBe(403);
    await as(admin);
    const r = await call(clientsRoute.POST, {}, { method: "POST", body: { name: "Ali's Home Store", reportingCurrency: "PKR" } });
    expect(r.status).toBe(201);
    expect(r.json.client.slug).toBe("alis-home-store-2");
  });

  it("removing a membership takes effect on the next request", async () => {
    await as(editorA);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(200);
    await removeMembership(A.id, editorA.id);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(404);
    await setMembership(A.id, editorA.id, "view");
    expect((await call(ordersRoute.POST, { clientId: A.id }, { method: "POST", body: order("A-9") })).status).toBe(403);
  });

  it("archived clients are hidden from members and stay editable for admins", async () => {
    await updateClient(A.id, { status: "Archived" });
    await as(editorA);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(404);
    expect((await call(clientsRoute.GET, {})).json.clients).toEqual([]);
    await as(admin);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(200);
    expect((await call(ordersRoute.POST, { clientId: A.id }, { method: "POST", body: order("A-5") })).status).toBe(201);
    await updateClient(A.id, { status: "Active" });
    await as(editorA);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(200);
  });

  it("deleting a client needs it archived and its name typed, and removes all its data", async () => {
    await as(admin);
    expect((await call(clientRoute.DELETE, { clientId: B.id }, { method: "DELETE", body: { confirmName: "Bella Beauty" } })).status).toBe(400);
    await updateClient(B.id, { status: "Archived" });
    expect((await call(clientRoute.DELETE, { clientId: B.id }, { method: "DELETE", body: { confirmName: "Bella" } })).status).toBe(400);
    const r = await call(clientRoute.DELETE, { clientId: B.id }, { method: "DELETE", body: { confirmName: "bella beauty" } });
    expect(r.json.deleted).toMatchObject({ orders: 1, expenses: 1 });
    expect(await OrderModel.countDocuments({ clientId: B.id })).toBe(0);
    expect(await OrderModel.countDocuments({ clientId: A.id })).toBe(1);
  });

  it("signed-out requests get 401", async () => {
    await as(null);
    expect((await call(ordersRoute.GET, { clientId: A.id })).status).toBe(401);
  });
});

describe("order IDs are unique per client", () => {
  it("allows the same order ID in two clients but not twice in one", async () => {
    await as(admin);
    expect((await call(ordersRoute.POST, { clientId: B.id }, { method: "POST", body: order("A-1") })).status).toBe(201);
    const dup = await call(ordersRoute.POST, { clientId: A.id }, { method: "POST", body: order("A-1") });
    expect(dup.status).toBe(409);
    expect(dup.json.error).toMatch(/already exists/);
  });

  it("imports skip IDs already in the same client only", async () => {
    await as(admin);
    const csv = "Order Date,Order ID,Product Name,Order Status,Quantity,Sale Price / Unit\n2026-11-01,B-1,Mug,Delivered,1,10\n";
    expect((await call(orderImportRoute.POST, { clientId: A.id }, { method: "POST", body: { csv } })).json).toMatchObject({ inserted: 1, skipped: 0 });
    expect((await call(orderImportRoute.POST, { clientId: B.id }, { method: "POST", body: { csv } })).json).toMatchObject({ inserted: 0, skipped: 1 });
  });
});

describe("reports inside a client", () => {
  it("keeps the reference case: 23.18 profit, (25.82) net after a $49 expense", async () => {
    const { orders, expenses } = await loadAll(A.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].calc.netProfit).toBeCloseTo(23.18, 2);
    const s = summarize(orders, expenses, "2026-11-01", "2026-11-30");
    expect(s.grossProfit).toBeCloseTo(23.18, 2);
    expect(s.businessExpenses).toBe(49);
    expect(s.netProfit).toBeCloseTo(-25.82, 2);
    expect(s.roi).toBeCloseTo(-25.82 / 75.8, 4);
  });

  it("overview summarises each active client separately in its own currency", async () => {
    const rows = await loadOverview("2026-11-01", "2026-11-30");
    const byName = Object.fromEntries(rows.map((r) => [r.client.name, r]));
    expect(byName["Ali's Home Store"]).toMatchObject({ currency: "USD", orders: 1, businessExpenses: 49, lastOrderDate: "2026-11-08" });
    expect(byName["Ali's Home Store"].netProfit).toBeCloseTo(-25.82, 2);
    expect(byName["Bella Beauty"]).toMatchObject({ currency: "GBP", businessExpenses: 39 });
    await updateClient(B.id, { status: "Archived" });
    expect((await loadOverview("2026-11-01", "2026-11-30")).map((r) => r.client.name)).toEqual(["Ali's Home Store"]);
  });
});
