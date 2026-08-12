import { authCookies, cookie } from "../../../lib/google-auth";

export async function GET() {
  const headers = new Headers({ Location: "https://valfsuite.valfservice.it/area-riservata" });
  headers.append("Set-Cookie", cookie(authCookies.session, "", 0, "Lax"));
  return new Response(null, { status: 302, headers });
}
