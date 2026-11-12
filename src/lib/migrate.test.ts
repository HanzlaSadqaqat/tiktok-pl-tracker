import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, startDb, stopDb } from "@/test/mongo";
import { migrateClients } from "./migrate";

const db = () => mongoose.connection.db!;
const indexNames = async (name: string) => (await db().collection(name).indexes()).map((i) => i.name);

beforeAll(() => startDb({ autoIndex: false }));
afterAll(stopDb);
beforeEach(resetDb);

describe("migrate:clients on an empty database", () => {
  it("creates My Shop with default settings and the indexes, then changes nothing", async () => {
    const first = await migrateClients({ dryRun: false });
    expect(first.changes).toBeGreaterThan(0);
    const client = await db().collection("clients").findOne({ slug: "my-shop" });
    expect(client?.name).toBe("My Shop");
    expect(await db().collection("settings").findOne({ clientId: client!._id })).toMatchObject({ reportingCurrency: "USD", lowMarginThreshold: 0.15 });
    expect(await indexNames("orders")).toContain("clientId_1_orderId_1");

    const second = await migrateClients({ dryRun: false });
    expect(second.changes).toBe(0);
    expect(second.lines).toEqual(["Nothing to change. The database is already migrated."]);
  });
});

describe("migrate:clients on a single-shop database", () => {
  beforeEach(async () => {
    // What the single-shop version left behind.
    const orders = db().collection("orders");
    await orders.createIndex({ orderId: 1 }, { unique: true, name: "orderId_1" });
    await orders.insertMany([
      { orderDate: "2026-11-01", orderId: "576001", productName: "Lamp", status: "Delivered", quantity: 1, salePrice: 10 },
      { orderDate: "2026-11-02", orderId: "576002", productName: "Mug", status: "Shipped", quantity: 2, salePrice: 5 },
    ]);
    await db().collection("expenses").insertOne({ date: "2026-11-03", name: "Kalodata", category: "Product Research Tools", amount: 49 });
    const settings = db().collection("settings");
    await settings.createIndex({ key: 1 }, { unique: true, name: "key_1" });
    await settings.insertOne({ key: "main", reportingCurrency: "GBP", lowMarginThreshold: 0.2, defaultTaxTreatment: "Deducted from payout", rates: { USD: 0.79 } });
    await db().collection("users").insertMany([
      { name: "Admin", email: "admin@x.test", passwordHash: "x", role: "admin", active: true, sessionVersion: 0 },
      { name: "Ed", email: "ed@x.test", passwordHash: "x", role: "editor", active: true, sessionVersion: 0 },
      { name: "Vi", email: "vi@x.test", passwordHash: "x", role: "viewer", active: true, sessionVersion: 0 },
    ]);
  });

  it("dry run reports every step and changes nothing", async () => {
    const report = await migrateClients({ dryRun: true });
    const text = report.lines.join("\n");
    expect(text).toMatch(/WOULD create client "My Shop"/);
    expect(text).toMatch(/WOULD drop index orders\.orderId_1/);
    expect(text).toMatch(/WOULD move 2 order\(s\)/);
    expect(text).toMatch(/WOULD move 1 business expense\(s\)/);
    expect(text).toMatch(/WOULD turn the existing settings \(currency GBP\)/);
    expect(text).toMatch(/WOULD make ed@x\.test a member with "edit" access/);
    expect(text).toMatch(/WOULD create index.*orders\.clientId_1_orderId_1/);
    expect(await db().collection("clients").countDocuments()).toBe(0);
    expect(await db().collection("orders").countDocuments({ clientId: { $exists: true } })).toBe(0);
    expect(await indexNames("orders")).toContain("orderId_1");
  });

  it("moves everything into My Shop, keeps the settings and fixes the indexes; a second run changes nothing", async () => {
    const report = await migrateClients({ dryRun: false });
    expect(report.changes).toBeGreaterThan(0);
    const client = await db().collection("clients").findOne({ slug: "my-shop" });
    expect(client).toBeTruthy();

    expect(await db().collection("orders").countDocuments({ clientId: client!._id })).toBe(2);
    expect(await db().collection("expenses").countDocuments({ clientId: client!._id })).toBe(1);

    const settings = await db().collection("settings").find().toArray();
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({ clientId: client!._id, reportingCurrency: "GBP", lowMarginThreshold: 0.2 });
    expect(settings[0]).not.toHaveProperty("key");

    const users = await db().collection("users").find({}, { sort: { email: 1 } }).toArray();
    expect(users.map((u) => u.role)).toEqual(["admin", "member", "member"]);
    const ms = await db().collection("memberships").find({ clientId: client!._id }).toArray();
    expect(Object.fromEntries(ms.map((m) => [String(m.userId), m.access]))).toEqual({
      [String(users[1]._id)]: "edit",
      [String(users[2]._id)]: "view",
    });

    const idx = await indexNames("orders");
    expect(idx).not.toContain("orderId_1");
    expect(idx).toEqual(expect.arrayContaining(["clientId_1_orderId_1", "clientId_1_orderDate_-1"]));
    expect(await indexNames("expenses")).toContain("clientId_1_date_-1");
    expect(await indexNames("settings")).not.toContain("key_1");
    expect(await indexNames("memberships")).toContain("userId_1_clientId_1");

    // The same order ID can now exist in another client, but not twice in one.
    const other = new mongoose.Types.ObjectId();
    await db().collection("orders").insertOne({ clientId: other, orderId: "576001" });
    await expect(db().collection("orders").insertOne({ clientId: client!._id, orderId: "576001" })).rejects.toThrow(/duplicate key/);

    const again = await migrateClients({ dryRun: false });
    expect(again.changes).toBe(0);
  });

  it("uses an existing my-shop client instead of creating another", async () => {
    const id = new mongoose.Types.ObjectId();
    await db().collection("clients").insertOne({ _id: id, name: "Existing", slug: "my-shop", status: "Active" });
    await migrateClients({ dryRun: false });
    expect(await db().collection("clients").countDocuments()).toBe(1);
    expect(await db().collection("orders").countDocuments({ clientId: id })).toBe(2);
  });

  it("never moves old data into an unrelated existing client: creates My Shop and repairs clients without settings", async () => {
    const other = new mongoose.Types.ObjectId();
    await db().collection("clients").insertOne({ _id: other, name: "Ziya Bhai Store", slug: "ziya-bhai-store", status: "Active" });
    const r = await migrateClients({ dryRun: false });
    const text = r.lines.join("\n");
    expect(text).toMatch(/create client "My Shop"/);
    expect(text).toMatch(/create default settings \(USD\) for "Ziya Bhai Store"/);
    const myShop = await db().collection("clients").findOne({ slug: "my-shop" });
    expect(await db().collection("orders").countDocuments({ clientId: myShop!._id })).toBe(2);
    expect(await db().collection("orders").countDocuments({ clientId: other })).toBe(0);
    expect(await db().collection("settings").findOne({ clientId: myShop!._id })).toMatchObject({ reportingCurrency: "GBP" });
    expect(await db().collection("settings").findOne({ clientId: other })).toMatchObject({ reportingCurrency: "USD" });
    expect((await migrateClients({ dryRun: false })).changes).toBe(0);
  });

  it("puts old data into the client named with --client", async () => {
    await db().collection("clients").insertMany([
      { name: "One", slug: "one", status: "Active" },
      { name: "Two", slug: "two", status: "Active" },
    ]);
    const r = await migrateClients({ dryRun: false, clientSlug: "two" });
    expect(r.lines.join("\n")).toMatch(/move 2 order\(s\) into "Two"/);
    expect(await db().collection("clients").countDocuments()).toBe(2);
  });
});
