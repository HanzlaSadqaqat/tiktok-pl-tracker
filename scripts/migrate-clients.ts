/**
 * Moves a single-shop database to clients. Safe to run more than once.
 *
 *   npm run migrate:clients -- --dry-run         show what would change, change nothing
 *   npm run migrate:clients                      apply
 *   npm run migrate:clients -- --client my-shop  put data without a client into this client
 *
 * Steps: create "My Shop" if there is no client, give every order and expense a client, turn the old
 * settings into that client's settings, turn old editor/viewer users into members of it, drop the old
 * unique index on orderId and create { clientId, orderId } and the other new indexes.
 */
import "./load-env";
import mongoose from "mongoose";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ci = args.indexOf("--client");
  const clientSlug = ci >= 0 ? args[ci + 1] : undefined;

  const { connectDb } = await import("../src/lib/db");
  const { migrateClients } = await import("../src/lib/migrate");
  // Never let Mongoose build indexes on its own while migrating: the migration decides.
  mongoose.set("autoIndex", false);
  await connectDb();

  const db = mongoose.connection.db?.databaseName;
  console.log(`${dryRun ? "DRY RUN (nothing is changed)" : "MIGRATING"} database "${db}"\n`);
  const report = await migrateClients({ dryRun, clientSlug });
  for (const line of report.lines) console.log(line);
  console.log(`\n${report.changes} change(s) ${dryRun ? "would be made" : "made"}.`);
  if (dryRun && report.changes) console.log("Run without --dry-run to apply them.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
