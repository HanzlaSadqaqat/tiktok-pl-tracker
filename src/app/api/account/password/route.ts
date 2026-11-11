import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { requireUser, setSessionCookie } from "@/lib/session";
import { changeOwnPassword } from "@/lib/users";
import { changePasswordSchema } from "@/lib/validation";

/** Changes your own password. Other devices are signed out; this one gets a fresh cookie. */
export const PUT = handle(async (req: Request) => {
  const me = await requireUser();
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  const sessionVersion = await changeOwnPassword(me.id, currentPassword, newPassword);
  const res = NextResponse.json({ ok: true });
  await setSessionCookie(res, me.id, sessionVersion);
  return res;
});
