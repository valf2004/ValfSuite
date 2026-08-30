import type { Metadata } from "next";
import { headers } from "next/headers";
import AlloggiatiSettingsForm from "../../area-privata/AlloggiatiSettingsForm";
import { PrivateHeader, PrivateLogin } from "../../area-privata/PrivateChrome";
import { getAlloggiatiSettingsSummary } from "../../lib/alloggiati-settings";
import { authIsConfigured, privateUserFromCookie } from "../../lib/google-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Impostazioni | VALF Suite", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const requestHeaders = await headers();
  const user = await privateUserFromCookie(requestHeaders.get("cookie"));
  if (!user) return <PrivateLogin configured={authIsConfigured()}/>;
  const summary = await getAlloggiatiSettingsSummary();
  return <main className="dashboard-page"><PrivateHeader user={user} active="settings"/><AlloggiatiSettingsForm initialSummary={summary}/></main>;
}
