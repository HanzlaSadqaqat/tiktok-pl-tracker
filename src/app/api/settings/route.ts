import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getSettings, saveSettings } from "@/lib/repo";
import { settingsSchema } from "@/lib/validation";

export const GET = handle(async () => {
  await requireUser();
  return NextResponse.json({ settings: await getSettings() });
});

export const PUT = handle(async (req: Request) => {
  await requireUser("admin");
  const input = await parseBody(req, settingsSchema);
  return NextResponse.json({ settings: await saveSettings(input) });
});
