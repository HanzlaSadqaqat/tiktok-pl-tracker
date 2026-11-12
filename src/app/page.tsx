import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/components/ui";
import { defaultClient } from "@/lib/home";
import { requirePage } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Admins start at the agency overview; members at their last (or only) client. */
export default async function Home() {
  const user = await requirePage();
  if (user.role === "admin") redirect("/clients");
  const client = await defaultClient(user);
  if (client) redirect(`/c/${client.slug}`);
  return (
    <>
      <PageHeader title={`Welcome, ${user.name}`} />
      <Empty>You have not been given access to any client yet. Ask the agency admin to add you.</Empty>
    </>
  );
}
