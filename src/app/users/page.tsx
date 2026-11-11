import type { Metadata } from "next";
import { UsersClient } from "@/components/UsersClient";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePage("admin");
  return <UsersClient meId={me.id} />;
}
