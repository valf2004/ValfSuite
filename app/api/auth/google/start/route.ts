import { authConfig, authCookies, authIsConfigured, codeChallenge, cookie, randomToken } from "../../../../lib/google-auth";

export async function GET() {
  if (!authIsConfigured()) return Response.redirect("https://valfsuite.valfservice.it/area-riservata?errore=configurazione", 302);
  const config = authConfig();
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  const headers = new Headers({ Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  headers.append("Set-Cookie", cookie(authCookies.state, state, 600));
  headers.append("Set-Cookie", cookie(authCookies.nonce, nonce, 600));
  headers.append("Set-Cookie", cookie(authCookies.verifier, verifier, 600));
  return new Response(null, { status: 302, headers });
}
