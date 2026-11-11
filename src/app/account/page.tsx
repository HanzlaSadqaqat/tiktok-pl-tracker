import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await requirePage();
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <Card title="Your details">
          <dl className="divide-y divide-line/70 text-sm">
            <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">Name</dt><dd className="font-medium text-navy">{me.name}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">Email</dt><dd className="break-all font-medium text-navy">{me.email}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">Access</dt><dd className="font-medium text-navy">{ROLE_LABELS[me.role]}</dd></div>
          </dl>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">
            {me.role === "admin" ? "Change names, emails and access on the Users page." : "Ask the admin to change your name, email or access."}
          </p>
        </Card>
        <Card title="Change password">
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
