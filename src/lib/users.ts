import "server-only";
import { HttpError } from "./api";
import { secretsMatch } from "./auth";
import { membershipsByUser, replaceMemberships } from "./clients";
import type { Role } from "./constants";
import { connectDb } from "./db";
import { MembershipModel, UserModel, type UserDoc } from "./models";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import type { MembershipRef, PublicUser } from "./types";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

type LeanUser = UserDoc & { _id: { toString(): string } };

export function toPublicUser(d: LeanUser, memberships: MembershipRef[] = []): PublicUser {
  return {
    id: d._id.toString(),
    name: d.name,
    email: d.email,
    role: d.role,
    active: d.active,
    lastLoginAt: d.lastLoginAt ? new Date(d.lastLoginAt).toISOString() : null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    memberships: d.role === "admin" ? [] : memberships,
  };
}

const normEmail = (email: string) => email.trim().toLowerCase();

export async function getUserById(id: string): Promise<LeanUser | null> {
  await connectDb();
  return (await UserModel.findById(id).lean()) as LeanUser | null;
}

export async function listUsers(): Promise<PublicUser[]> {
  await connectDb();
  const docs = (await UserModel.find().sort({ role: 1, name: 1 }).lean()) as LeanUser[];
  const ms = await membershipsByUser(docs.map((d) => d._id.toString()));
  return docs.map((d) => toPublicUser(d, ms.get(d._id.toString())));
}

/**
 * The first admin comes from ADMIN_EMAIL / ADMIN_PASSWORD. It is created the first time someone signs in
 * with exactly those details while no admin account exists. Once an admin exists these variables are ignored.
 */
async function bootstrapAdmin(email: string, password: string): Promise<LeanUser | null> {
  const envEmail = normEmail(process.env.ADMIN_EMAIL ?? "");
  const envPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!envEmail || envPassword.length < 8 || email !== envEmail) return null;
  if (!(await secretsMatch(password, envPassword))) return null;
  if (await UserModel.exists({ role: "admin" })) return null;
  const doc = await UserModel.create({
    name: process.env.ADMIN_NAME?.trim() || "Admin",
    email,
    passwordHash: await hashPassword(password),
    role: "admin",
  });
  return doc.toObject() as LeanUser;
}

/** Checks an email and password. Returns the user, or throws a 401/429 HttpError with a safe message. */
export async function authenticate(rawEmail: string, password: string): Promise<LeanUser> {
  await connectDb();
  const email = normEmail(rawEmail);
  const wrong = new HttpError(401, "Wrong email or password");
  const user = (await UserModel.findOne({ email }).lean()) as LeanUser | null;

  if (!user) {
    const created = await bootstrapAdmin(email, password);
    if (created) return markLogin(created);
    await verifyPassword(password, await dummyHash()); // same work as a real check
    throw wrong;
  }

  if (user.lockedUntil > Date.now()) {
    const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    throw new HttpError(429, `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await UserModel.updateOne(
      { _id: user._id },
      failed >= MAX_FAILED_LOGINS
        ? { $set: { failedLogins: 0, lockedUntil: Date.now() + LOCK_MINUTES * 60000 } }
        : { $set: { failedLogins: failed } },
    );
    throw wrong;
  }

  // Checked after the password, so a wrong password never reveals that an account exists but is disabled.
  if (!user.active) throw new HttpError(403, "This account has been deactivated. Ask the admin for access.");
  return markLogin(user);
}

async function markLogin(user: LeanUser): Promise<LeanUser> {
  await UserModel.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: 0, lastLoginAt: new Date() } });
  return user;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  memberships?: MembershipRef[];
}): Promise<PublicUser> {
  await connectDb();
  const email = normEmail(input.email);
  if (await UserModel.exists({ email })) throw new HttpError(409, "A user with this email already exists");
  const doc = await UserModel.create({ name: input.name, email, role: input.role, passwordHash: await hashPassword(input.password) });
  const id = doc._id.toString();
  if (input.role === "member" && input.memberships?.length) {
    try {
      await replaceMemberships(id, input.memberships);
    } catch (err) {
      await UserModel.deleteOne({ _id: id }); // do not leave a half-created account behind
      throw err;
    }
  }
  return publicUser(id);
}

async function publicUser(id: string): Promise<PublicUser> {
  const doc = await getUserById(id);
  if (!doc) throw new HttpError(404, "User not found");
  return toPublicUser(doc, (await membershipsByUser([id])).get(id));
}

/** Throws when the change would leave the app without an active admin. */
async function ensureAnotherAdmin(exceptId: string) {
  const others = await UserModel.countDocuments({ _id: { $ne: exceptId }, role: "admin", active: true });
  if (others === 0) throw new HttpError(400, "There must always be at least one active admin");
}

export async function updateUser(
  id: string,
  actorId: string,
  patch: { name?: string; email?: string; role?: Role; active?: boolean; password?: string; memberships?: MembershipRef[] },
): Promise<PublicUser> {
  await connectDb();
  const user = await getUserById(id);
  if (!user) throw new HttpError(404, "User not found");
  const self = id === actorId;
  if (self && patch.role && patch.role !== user.role) throw new HttpError(400, "You cannot change your own role");
  if (self && patch.active === false) throw new HttpError(400, "You cannot deactivate your own account");
  const losesAdmin = user.role === "admin" && user.active && ((patch.role && patch.role !== "admin") || patch.active === false);
  if (losesAdmin) await ensureAnotherAdmin(id);

  const set: Partial<UserDoc> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.role !== undefined) set.role = patch.role;
  if (patch.active !== undefined) set.active = patch.active;
  if (patch.email !== undefined) {
    const email = normEmail(patch.email);
    if (email !== user.email && (await UserModel.exists({ email }))) throw new HttpError(409, "A user with this email already exists");
    set.email = email;
  }
  // A new password or deactivation signs the user out of every device.
  const signOut = patch.password !== undefined || patch.active === false;
  if (patch.password !== undefined) {
    set.passwordHash = await hashPassword(patch.password);
    set.failedLogins = 0;
    set.lockedUntil = 0;
  }
  const doc = (await UserModel.findByIdAndUpdate(
    id,
    { $set: set, ...(signOut && { $inc: { sessionVersion: 1 } }) },
    { returnDocument: "after", runValidators: true },
  ).lean()) as LeanUser | null;
  if (!doc) throw new HttpError(404, "User not found");
  if (patch.memberships !== undefined) await replaceMemberships(id, patch.memberships);
  return publicUser(id);
}

export async function deleteUser(id: string, actorId: string): Promise<void> {
  await connectDb();
  if (id === actorId) throw new HttpError(400, "You cannot delete your own account");
  const user = await getUserById(id);
  if (!user) throw new HttpError(404, "User not found");
  if (user.role === "admin" && user.active) await ensureAnotherAdmin(id);
  await UserModel.deleteOne({ _id: id });
  await MembershipModel.deleteMany({ userId: id });
}

/** Changes the signed-in user's own password. Returns the new session version so the caller can re-issue the cookie. */
export async function changeOwnPassword(id: string, current: string, next: string): Promise<number> {
  await connectDb();
  const user = await getUserById(id);
  if (!user) throw new HttpError(404, "User not found");
  if (!(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, "Your current password is wrong");
  const doc = await UserModel.findByIdAndUpdate(
    id,
    { $set: { passwordHash: await hashPassword(next) }, $inc: { sessionVersion: 1 } },
    { returnDocument: "after" },
  ).lean();
  return doc?.sessionVersion ?? 0;
}
