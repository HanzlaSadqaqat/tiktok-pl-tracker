import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { SESSION_COOKIE, SESSION_DAYS, authEnabled, checkPassword, createSessionToken } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  if (!authEnabled()) return NextResponse.json({ ok: true });
  const { password } = await parseBody(req, z.object({ password: z.string().max(500) }));
  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
});
