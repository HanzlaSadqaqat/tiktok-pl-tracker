import type { Metadata } from "next";
import { OrdersClient } from "@/components/OrdersClient";
import { timeZone } from "@/lib/data";
import { todayIn } from "@/lib/periods";
import { requireClientPage } from "@/lib/session";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

type Params = Promise<{ clientSlug: string }>;

export default async function OrdersPage({ params }: { params: Params }) {
  const { client, canEdit } = await requireClientPage((await params).clientSlug);
  return <OrdersClient key={client.id} clientId={client.id} clientName={client.name} today={todayIn(timeZone())} canEdit={canEdit} />;
}
