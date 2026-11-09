import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { authEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "TikTok Shop P&L", template: "%s · TikTok Shop P&L" },
  description: "Track every TikTok Shop order, real profit, ROI and business expenses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav showSignOut={authEnabled()} />
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
