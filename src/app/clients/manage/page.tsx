import type { Metadata } from "next";
import { ClientsManager } from "@/components/ClientsManager";
import { listClients } from "@/lib/clients";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ManageClientsPage() {
  await requirePage("admin");
  return <ClientsManager initial={await listClients()} />;
}
