import type { Metadata } from "next";
import { OrdersClient } from "@/components/OrdersClient";
import { timeZone } from "@/lib/data";
import { hasRole } from "@/lib/constants";
import { todayIn } from "@/lib/periods";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requirePage();
  return <OrdersClient today={todayIn(timeZone())} canEdit={hasRole(user.role, "editor")} />;
}
