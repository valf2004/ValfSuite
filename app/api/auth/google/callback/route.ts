import { authConfig, authCookies, authIsConfigured, cookie, readCookie, signPrivateSession, verifyGoogleIdToken } from "../../../../lib/google-auth";

export async function GET(request: Request) {
  const current = new URL(request.url);
  const failure = (reason: string) => Response.redirect(`https://valfsuite.valfservice.it/area-riservata?errore=${encodeURIComponent(reason)}`, 302);
  if (!authIsConfigured()) return failure("configurazione");
  if (current.searchParams.get("error")) return failure("accesso_annullato");
  const cookieHeader = request.headers.get("cookie");
  const state = current.searchParams.get("state");
  const expectedState = readCookie(cookieHeader, authCookies.state);
  const nonce = readCookie(cookieHeader, authCookies.nonce);
  const verifier = readCookie(cookieHeader, authCookies.verifier);
  const code = current.searchParams.get("code");
  if (!state || !expectedState || state !== expectedState || !nonce || !verifier || !code) return failure("sessione_scaduta");
  try {
    const config = authConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    });
    if (!tokenResponse.ok) return failure("google");
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) return failure("google");
    const user = await verifyGoogleIdToken(tokens.id_token, nonce);
    const session = await signPrivateSession(user);
    const headers = new Headers({ Location: "https://valfsuite.valfservice.it/area-riservata" });
    headers.append("Set-Cookie", cookie(authCookies.session, session, 8 * 60 * 60, "Lax"));
    headers.append("Set-Cookie", cookie(authCookies.state, "", 0));
    headers.append("Set-Cookie", cookie(authCookies.nonce, "", 0));
    headers.append("Set-Cookie", cookie(authCookies.verifier, "", 0));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return failure(error instanceof Error && error.message === "Account not authorized" ? "non_autorizzato" : "verifica");
  }
}
