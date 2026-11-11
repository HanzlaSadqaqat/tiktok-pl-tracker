import type { Metadata } from "next";
import { ExpensesClient } from "@/components/ExpensesClient";
import { timeZone } from "@/lib/data";
import { hasRole } from "@/lib/constants";
import { todayIn } from "@/lib/periods";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Business Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requirePage();
  return <ExpensesClient today={todayIn(timeZone())} canEdit={hasRole(user.role, "editor")} />;
}
