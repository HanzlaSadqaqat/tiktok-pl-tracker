import type { Metadata } from "next";
import { ExpensesClient } from "@/components/ExpensesClient";
import { timeZone } from "@/lib/data";
import { todayIn } from "@/lib/periods";

export const metadata: Metadata = { title: "Business Expenses" };
export const dynamic = "force-dynamic";

export default function ExpensesPage() {
  return <ExpensesClient today={todayIn(timeZone())} />;
}
