import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
import { ClientPeople } from "@/components/ClientPeople";
import { requireClientPage } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

type Params = Promise<{ clientSlug: string }>;

export default async function SettingsPage({ params }: { params: Params }) {
  const { client } = await requireClientPage((await params).clientSlug, "admin");
  return (
    <>
      <SettingsForm key={client.id} clientId={client.id} clientName={client.name} />
      <ClientPeople clientId={client.id} clientName={client.name} />
    </>
  );
}
