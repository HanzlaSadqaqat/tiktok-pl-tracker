import type { Metadata } from "next";
import { OrdersClient } from "@/components/OrdersClient";
import { timeZone } from "@/lib/data";
import { todayIn } from "@/lib/periods";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return <OrdersClient today={todayIn(timeZone())} />;
}
