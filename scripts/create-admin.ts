/**
 * Creates an admin account, or resets an existing account to admin with a new password.
 * Use it if you forget the admin password or get locked out.
 *
 *   npm run create-admin -- you@example.com "a-strong-password" "Your Name"
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
  const [rawEmail, password, name] = process.argv.slice(2);
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    console.error('Usage: npm run create-admin -- you@example.com "a-strong-password" "Your Name"');
    process.exit(1);
  }
  const { MIN_PASSWORD_LENGTH } = await import("../src/lib/constants");
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  const { connectDb } = await import("../src/lib/db");
  const { UserModel } = await import("../src/lib/models");
  const { hashPassword } = await import("../src/lib/password");
  await connectDb();

  const passwordHash = await hashPassword(password);
  const existing = await UserModel.findOne({ email });
  if (existing) {
    await UserModel.updateOne(
      { _id: existing._id },
      { $set: { passwordHash, role: "admin", active: true, failedLogins: 0, lockedUntil: 0, ...(name && { name }) }, $inc: { sessionVersion: 1 } },
    );
    console.log(`Updated ${email}: now an active admin with the new password.`);
  } else {
    await UserModel.create({ email, name: name || "Admin", passwordHash, role: "admin" });
    console.log(`Created admin ${email}.`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
