import type { Metadata } from "next";
import { SettingsForm } from "@/components/SettingsForm";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePage("admin");
  return <SettingsForm />;
}
