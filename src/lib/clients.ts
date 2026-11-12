import "server-only";
import { HttpError } from "./api";
import type { ClientAccess, ClientStatus, EffectiveAccess } from "./constants";
import { connectDb } from "./db";
import { ClientModel, ExpenseModel, MembershipModel, OrderModel, SettingsModel, UserModel, type ClientDoc } from "./models";
import { DEFAULT_SETTINGS } from "./repo";
import type { AppSettings, Client, ClientInput, ClientPerson, ClientWithAccess, MembershipRef, SessionUser } from "./types";

type LeanClient = ClientDoc & { _id: { toString(): string } };

const isId = (s: string) => /^[a-f0-9]{24}$/i.test(s);

export function toClient(d: LeanClient): Client {
  return {
    id: d._id.toString(),
    name: d.name,
    slug: d.slug,
    shopName: d.shopName ?? "",
    marketplace: d.marketplace ?? "",
    contactName: d.contactName ?? "",
    contactEmail: d.contactEmail ?? "",
    notes: d.notes ?? "",
    status: d.status,
  };
}

/** "Ali's Home Store!" -> "alis-home-store" */
export function slugify(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return s || "client";
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await ClientModel.exists({ slug, ...(exceptId && { _id: { $ne: exceptId } }) });
    if (!clash) return slug;
  }
}

/** Finds a client by id or slug. Returns null when there is none. No access check: use requireClientAccess(). */
export async function findClient(slugOrId: string): Promise<Client | null> {
  await connectDb();
  const key = String(slugOrId ?? "").trim().toLowerCase();
  if (!key) return null;
  const doc = ((isId(key) && (await ClientModel.findById(key).lean())) || (await ClientModel.findOne({ slug: key }).lean())) as LeanClient | null;
  return doc ? toClient(doc) : null;
}

/** What `user` may do on `client`, or null for no access. Archived clients are hidden from members. */
export async function accessFor(user: SessionUser, client: Client): Promise<EffectiveAccess | null> {
  if (user.role === "admin") return "admin";
  if (client.status !== "Active") return null;
  await connectDb();
  const m = await MembershipModel.findOne({ userId: user.id, clientId: client.id }, { access: 1 }).lean();
  return m?.access ?? null;
}

/** Clients the user can open, with their access. Admins see every client (archived last); members only active clients they belong to. */
export async function clientsForUser(user: SessionUser): Promise<ClientWithAccess[]> {
  await connectDb();
  if (user.role === "admin") {
    const docs = (await ClientModel.find().sort({ status: 1, name: 1 }).lean()) as LeanClient[];
    return docs.map((d) => ({ ...toClient(d), access: "admin" as const }));
  }
  const ms = await MembershipModel.find({ userId: user.id }, { clientId: 1, access: 1 }).lean();
  const access = new Map(ms.map((m) => [m.clientId.toString(), m.access]));
  const docs = (await ClientModel.find({ _id: { $in: [...access.keys()] }, status: "Active" }).sort({ name: 1 }).lean()) as LeanClient[];
  return docs.map((d) => ({ ...toClient(d), access: access.get(d._id.toString())! }));
}

export async function listClients(status?: ClientStatus): Promise<Client[]> {
  await connectDb();
  const docs = (await ClientModel.find(status ? { status } : {}).sort({ status: 1, name: 1 }).lean()) as LeanClient[];
  return docs.map(toClient);
}

/** Creates a client and its settings. */
export async function createClient(input: ClientInput, settings: Partial<AppSettings> = {}): Promise<Client> {
  await connectDb();
  const slug = await uniqueSlug(slugify(input.slug || input.name));
  if (input.slug && slug !== slugify(input.slug)) throw new HttpError(409, `The web address "${slugify(input.slug)}" is already used by another client`);
  const doc = await ClientModel.create({ ...input, slug, status: "Active" });
  try {
    await SettingsModel.updateOne(
      { clientId: doc._id },
      { $setOnInsert: { clientId: doc._id, ...DEFAULT_SETTINGS, ...settings } },
      { upsert: true },
    );
  } catch (err) {
    // Never leave a client without settings behind: undo and report the error.
    await ClientModel.deleteOne({ _id: doc._id });
    throw err;
  }
  return toClient(doc.toObject() as LeanClient);
}

export async function updateClient(id: string, patch: Partial<ClientInput> & { status?: ClientStatus }): Promise<Client> {
  await connectDb();
  const set: Record<string, unknown> = { ...patch };
  if (patch.slug !== undefined) {
    const wanted = slugify(patch.slug);
    if (await ClientModel.exists({ slug: wanted, _id: { $ne: id } })) {
      throw new HttpError(409, `The web address "${wanted}" is already used by another client`);
    }
    set.slug = wanted;
  }
  const doc = (await ClientModel.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true }).lean()) as LeanClient | null;
  if (!doc) throw new HttpError(404, "Client not found");
  return toClient(doc);
}

/** Permanently deletes an archived client and everything that belongs to it. */
export async function deleteClient(id: string, confirmName: string): Promise<{ orders: number; expenses: number; memberships: number }> {
  await connectDb();
  const doc = (await ClientModel.findById(id).lean()) as LeanClient | null;
  if (!doc) throw new HttpError(404, "Client not found");
  if (doc.status !== "Archived") throw new HttpError(400, "Archive the client before deleting it");
  if (confirmName.trim().toLowerCase() !== doc.name.trim().toLowerCase()) {
    throw new HttpError(400, "Type the client's name exactly to confirm");
  }
  const [o, e, m] = await Promise.all([
    OrderModel.deleteMany({ clientId: id }),
    ExpenseModel.deleteMany({ clientId: id }),
    MembershipModel.deleteMany({ clientId: id }),
    SettingsModel.deleteMany({ clientId: id }),
  ]);
  await ClientModel.deleteOne({ _id: id });
  return { orders: o.deletedCount, expenses: e.deletedCount, memberships: m.deletedCount };
}

// ---------------------------------------------------------------- Memberships

/** Members with access to a client. Admins are not listed: they can access every client. */
export async function listPeople(clientId: string): Promise<ClientPerson[]> {
  await connectDb();
  const ms = await MembershipModel.find({ clientId }).lean();
  const users = await UserModel.find({ _id: { $in: ms.map((m) => m.userId) } }, { name: 1, email: 1, active: 1, role: 1 }).lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return ms
    .flatMap((m) => {
      const u = byId.get(m.userId.toString());
      return u && u.role === "member" ? [{ userId: u._id.toString(), name: u.name, email: u.email, active: u.active, access: m.access }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setMembership(clientId: string, userId: string, access: ClientAccess): Promise<void> {
  await connectDb();
  const user = await UserModel.findById(userId, { role: 1 }).lean();
  if (!user) throw new HttpError(404, "User not found");
  if (user.role === "admin") throw new HttpError(400, "Agency admins already have access to every client");
  if (!(await ClientModel.exists({ _id: clientId }))) throw new HttpError(404, "Client not found");
  await MembershipModel.updateOne({ userId, clientId }, { $set: { access } }, { upsert: true, runValidators: true });
}

export async function removeMembership(clientId: string, userId: string): Promise<boolean> {
  await connectDb();
  return (await MembershipModel.deleteOne({ userId, clientId })).deletedCount > 0;
}

export async function membershipsByUser(userIds: string[]): Promise<Map<string, MembershipRef[]>> {
  await connectDb();
  const ms = await MembershipModel.find({ userId: { $in: userIds } }, { userId: 1, clientId: 1, access: 1 }).lean();
  const out = new Map<string, MembershipRef[]>();
  for (const m of ms) {
    const k = m.userId.toString();
    out.set(k, [...(out.get(k) ?? []), { clientId: m.clientId.toString(), access: m.access }]);
  }
  return out;
}

/** Replaces all of a user's memberships with `list`. */
export async function replaceMemberships(userId: string, list: MembershipRef[]): Promise<void> {
  await connectDb();
  const ids = [...new Set(list.map((m) => m.clientId))];
  if (ids.some((id) => !isId(id))) throw new HttpError(400, "Unknown client");
  const found = await ClientModel.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw new HttpError(400, "Unknown client");
  await MembershipModel.deleteMany({ userId, clientId: { $nin: ids } });
  if (list.length) {
    await MembershipModel.bulkWrite(
      list.map((m) => ({ updateOne: { filter: { userId, clientId: m.clientId }, update: { $set: { access: m.access } }, upsert: true } })),
    );
  }
}
