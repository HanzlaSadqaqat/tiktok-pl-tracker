import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/repo";
import { requireClientApi } from "@/lib/session";
import { settingsSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ clientId: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "view");
  return NextResponse.json({ settings: await getSettings(client.id) });
});

/** Settings and exchange rates: agency admins only. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { client } = await requireClientApi((await ctx.params).clientId, "admin");
  return NextResponse.json({ settings: await saveSettings(client.id, await parseBody(req, settingsSchema)) });
});
