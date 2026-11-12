import type { Metadata } from "next";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { clientsForUser } from "@/lib/clients";
import { LAST_CLIENT_COOKIE } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import type { ClientWithAccess, SessionUser } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "TikTok Shop P&L", template: "%s · TikTok Shop P&L" },
  description: "Track every TikTok Shop order, real profit, ROI and business expenses, for every client.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A database error must not break the sign-in page, so the menu is simply hidden then.
  let user: SessionUser | null = null;
  let clients: ClientWithAccess[] = [];
  try {
    user = await getCurrentUser();
    if (user) clients = await clientsForUser(user);
  } catch (err) {
    unstable_rethrow(err); // let Next handle its own signals (dynamic rendering, redirects)
    console.error(err);
  }
  const lastClientId = (await cookies()).get(LAST_CLIENT_COOKIE)?.value ?? null;
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav user={user} clients={clients} lastClientId={lastClientId} />
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
