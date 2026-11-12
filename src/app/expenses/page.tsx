import { redirectToClientPage } from "@/lib/legacy";

export const dynamic = "force-dynamic";

/** Old URL from before clients existed. */
export default async function Legacy() {
  return redirectToClientPage("expenses");
}
