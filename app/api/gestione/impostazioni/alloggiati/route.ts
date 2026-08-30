import { headers } from "next/headers";
import { getAlloggiatiSettingsSummary, saveAlloggiatiSettings, type AlloggiatiSettingsInput } from "../../../../lib/alloggiati-settings";
import { privateUserFromCookie } from "../../../../lib/google-auth";

export const dynamic = "force-dynamic";

async function authenticatedUser() {
  const requestHeaders = await headers();
  return privateUserFromCookie(requestHeaders.get("cookie"));
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ settings: await getAlloggiatiSettingsSummary() });
}

export async function PUT(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const input = await request.json() as AlloggiatiSettingsInput;
    const settings = await saveAlloggiatiSettings(input, user.email);
    return Response.json({ settings });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Impossibile salvare le impostazioni." }, { status: 400 });
  }
}
