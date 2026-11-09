import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/repo";
import { settingsSchema } from "@/lib/validation";

export const GET = handle(async () => NextResponse.json({ settings: await getSettings() }));

export const PUT = handle(async (req: Request) => {
  const input = await parseBody(req, settingsSchema);
  return NextResponse.json({ settings: await saveSettings(input) });
});
