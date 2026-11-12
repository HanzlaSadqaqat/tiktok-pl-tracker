import type { Metadata } from "next";
import { ExpensesClient } from "@/components/ExpensesClient";
import { timeZone } from "@/lib/data";
import { todayIn } from "@/lib/periods";
import { requireClientPage } from "@/lib/session";

export const metadata: Metadata = { title: "Business Expenses" };
export const dynamic = "force-dynamic";

type Params = Promise<{ clientSlug: string }>;

export default async function ExpensesPage({ params }: { params: Params }) {
  const { client, canEdit } = await requireClientPage((await params).clientSlug);
  return <ExpensesClient key={client.id} clientId={client.id} clientName={client.name} today={todayIn(timeZone())} canEdit={canEdit} />;
}
