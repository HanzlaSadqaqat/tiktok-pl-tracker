/**
 * One-off migration from the single-shop app to clients. Idempotent: a second run changes nothing.
 * Used by `npm run migrate:clients` (scripts/migrate-clients.ts) and by the tests.
 *
 * Works on the raw collections (not through the schemas), because the old documents do not match
 * the new schemas yet. No "server-only" import, so it can run from a script.
 */
import { Types, type Collection, type Model } from "mongoose";
import { ClientModel, ExpenseModel, MembershipModel, OrderModel, SettingsModel, UserModel } from "./models";
import { DEFAULT_SETTINGS } from "./defaults";

export const DEFAULT_CLIENT = { name: "My Shop", slug: "my-shop" };

/** Indexes from the single-shop version that conflict with clients and must be dropped. */
const OLD_INDEXES: { model: Model<never>; name: string; why: string }[] = [
  { model: OrderModel as unknown as Model<never>, name: "orderId_1", why: "Order IDs are now unique per client, not across all clients" },
  { model: SettingsModel as unknown as Model<never>, name: "key_1", why: "settings are now one document per client" },
];

export interface MigrationReport {
  dryRun: boolean;
  changes: number;
  lines: string[];
}

const noClient = { $or: [{ clientId: { $exists: false } }, { clientId: null }] };

async function indexNames(c: Collection): Promise<string[]> {
  try {
    return (await c.indexes()).map((i) => String(i.name));
  } catch (err) {
    if ((err as { code?: number }).code === 26) return []; // collection does not exist yet
    throw err;
  }
}

export async function migrateClients(opts: { dryRun: boolean; clientSlug?: string }): Promise<MigrationReport> {
  const { dryRun } = opts;
  const lines: string[] = [];
  let changes = 0;
  const did = (msg: string) => {
    changes++;
    lines.push(`${dryRun ? "WOULD " : ""}${msg}`);
  };
  const note = (msg: string) => lines.push(`  ${msg}`);

  const clients = ClientModel.collection;
  const orders = OrderModel.collection;
  const expenses = ExpenseModel.collection;
  const settings = SettingsModel.collection;
  const users = UserModel.collection;
  const memberships = MembershipModel.collection;

  // 1. The client that data from the single-shop version moves into: the one named with --client,
  //    else "My Shop" (created when needed). Never an unrelated client that happens to exist already.
  let target: { _id: Types.ObjectId; name: string; slug: string } | null = null;
  const wanted = opts.clientSlug?.trim().toLowerCase();
  const clientCount = await clients.countDocuments();
  const orphanOrders = await orders.countDocuments(noClient);
  const orphanExpenses = await expenses.countDocuments(noClient);
  const oldSettings = await settings.findOne({ key: "main" });
  const oldRoleUsers = await users.find({ role: { $in: ["editor", "viewer"] } }).toArray();
  const leftovers = orphanOrders > 0 || orphanExpenses > 0 || !!oldSettings || oldRoleUsers.length > 0;
  if (wanted) {
    target = (await clients.findOne({ slug: wanted })) as typeof target;
    if (!target) throw new Error(`No client with the web address "${wanted}"`);
  } else if ((target = (await clients.findOne({ slug: DEFAULT_CLIENT.slug })) as typeof target)) {
    // An existing "My Shop" is used as it is.
  } else if (clientCount === 0 || leftovers) {
    target = { _id: new Types.ObjectId(), ...DEFAULT_CLIENT };
    did(`create client "${DEFAULT_CLIENT.name}" (/c/${DEFAULT_CLIENT.slug})`);
    if (!dryRun) {
      const now = new Date();
      await clients.insertOne({
        ...target, shopName: "", marketplace: "", contactName: "", contactEmail: "", notes: "", status: "Active", createdAt: now, updatedAt: now,
      });
    }
  }

  // 2. Drop old indexes first, so nothing blocks the data changes below.
  for (const { model, name, why } of OLD_INDEXES) {
    if ((await indexNames(model.collection)).includes(name)) {
      did(`drop index ${model.collection.collectionName}.${name} (${why})`);
      if (!dryRun) await model.collection.dropIndex(name);
    }
  }

  // 3. Orders and expenses without a client.
  if (orphanOrders) {
    did(`move ${orphanOrders} order(s) into "${target!.name}"`);
    if (!dryRun) await orders.updateMany(noClient, { $set: { clientId: target!._id } });
  }
  if (orphanExpenses) {
    did(`move ${orphanExpenses} business expense(s) into "${target!.name}"`);
    if (!dryRun) await expenses.updateMany(noClient, { $set: { clientId: target!._id } });
  }

  // 4. The old single settings document becomes the target client's settings.
  if (target) {
    const targetHasSettings = !!(await settings.findOne({ clientId: target._id }));
    if (oldSettings && !targetHasSettings) {
      did(`turn the existing settings (currency ${oldSettings.reportingCurrency ?? "USD"}) into "${target.name}"'s settings`);
      if (!dryRun) await settings.updateOne({ _id: oldSettings._id }, { $set: { clientId: target._id }, $unset: { key: "" } });
    } else if (oldSettings && targetHasSettings) {
      note(`kept the old "main" settings document untouched: "${target.name}" already has its own settings`);
    } else if (!targetHasSettings) {
      did(`create default settings for "${target.name}"`);
      if (!dryRun) {
        const now = new Date();
        await settings.insertOne({ clientId: target._id, ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now });
      }
    }
  }

  // 4b. Every other client needs settings too (repairs a client created without them).
  const withSettings = new Set(
    (await settings.find({ clientId: { $exists: true } }, { projection: { clientId: 1 } }).toArray()).map((d) => String(d.clientId)),
  );
  for (const c of await clients.find({}, { projection: { name: 1 } }).toArray()) {
    if (withSettings.has(String(c._id)) || (target && String(c._id) === String(target._id))) continue;
    did(`create default settings (USD) for "${c.name}", which has none`);
    if (!dryRun) {
      const now = new Date();
      await settings.insertOne({ clientId: c._id, ...DEFAULT_SETTINGS, createdAt: now, updatedAt: now });
    }
  }

  // 5. Old roles "editor" / "viewer" become members with edit / view access on the target client.
  for (const u of oldRoleUsers) {
    const access = u.role === "editor" ? "edit" : "view";
    did(`make ${u.email} a member with "${access}" access${target ? ` to "${target.name}"` : ""} (was ${u.role})`);
    if (!dryRun) {
      await users.updateOne({ _id: u._id }, { $set: { role: "member" } });
      if (target) {
        await memberships.updateOne(
          { userId: u._id, clientId: target._id },
          { $setOnInsert: { userId: u._id, clientId: target._id, access, createdAt: new Date(), updatedAt: new Date() } },
          { upsert: true },
        );
      }
    }
  }

  // 6. Create every index the schemas define, e.g. { clientId, orderId } unique.
  for (const model of [ClientModel, OrderModel, ExpenseModel, SettingsModel, UserModel, MembershipModel] as unknown as Model<never>[]) {
    const have = new Set(await indexNames(model.collection));
    const want = model.schema
      .indexes()
      .map(([fields, options]) => (options as { name?: string }).name ?? Object.entries(fields).map(([k, v]) => `${k}_${v}`).join("_"));
    const fieldIdx = Object.entries(model.schema.paths)
      .filter(([, p]) => (p as { options?: { unique?: boolean; index?: boolean } }).options?.unique || (p as { options?: { index?: boolean } }).options?.index)
      .map(([k]) => `${k}_1`);
    const toCreate = [...new Set([...want, ...fieldIdx])].filter((n) => !have.has(n));
    if (toCreate.length) {
      did(`create index${toCreate.length > 1 ? "es" : ""} ${toCreate.map((n) => `${model.collection.collectionName}.${n}`).join(", ")}`);
      if (!dryRun) await model.createIndexes();
    }
  }

  if (!changes) lines.push("Nothing to change. The database is already migrated.");
  return { dryRun, changes, lines };
}

