/**
 * Test database: a throwaway in-memory MongoDB (mongodb-memory-server). Never touches Atlas.
 * The MongoDB version is pinned in package.json ("config.mongodbMemoryServer.version").
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let server: MongoMemoryServer | null = null;

export async function startDb(opts: { autoIndex?: boolean } = {}) {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("tt-test");
  mongoose.set("autoIndex", opts.autoIndex ?? false);
  globalThis._mongoose = { conn: null, promise: null };
  const { connectDb } = await import("@/lib/db");
  await connectDb();
}

export async function stopDb() {
  await mongoose.disconnect();
  globalThis._mongoose = { conn: null, promise: null };
  await server?.stop();
  server = null;
}

export async function resetDb() {
  await mongoose.connection.db?.dropDatabase();
}

/** Builds every index the schemas define (what Mongoose does on its own in the app). */
export async function buildIndexes() {
  const m = await import("@/lib/models");
  for (const model of [m.ClientModel, m.OrderModel, m.ExpenseModel, m.SettingsModel, m.UserModel, m.MembershipModel]) {
    await (model as unknown as mongoose.Model<unknown>).createIndexes();
  }
}
