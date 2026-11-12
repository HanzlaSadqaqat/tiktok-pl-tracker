import "server-only";
import { redirect } from "next/navigation";
import { defaultClient } from "./home";
import { requirePage } from "./session";

/** Old single-shop URLs (/orders, /reports, ...) open the same page for the last client used. */
export async function redirectToClientPage(sub: "orders" | "expenses" | "reports" | "products" | "settings"): Promise<never> {
  const user = await requirePage();
  const client = await defaultClient(user);
  redirect(client ? `/c/${client.slug}/${sub}` : "/");
}
