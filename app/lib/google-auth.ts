import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

export type PrivateUser = { email: string; name: string; picture?: string };

const SESSION_COOKIE = "valf_private_session";
const SESSION_ISSUER = "valfsuite-private-area";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const defaultAllowed = ["valfsuite@gmail.com", "viliorlandi@gmail.com", "angrimaldi79@gmail.com", "valf2004@gmail.com"];

export function authConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "",
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "https://valfsuite.valfservice.it/api/auth/google/callback",
    sessionSecret: process.env.AUTH_SESSION_SECRET?.trim() ?? "",
    allowedEmails: (process.env.AUTHORIZED_ADMIN_EMAILS || defaultAllowed.join(",")).split(",").map(value => value.trim().toLowerCase()).filter(Boolean),
  };
}

export function authIsConfigured() {
  const config = authConfig();
  return Boolean(config.clientId && config.clientSecret && config.sessionSecret.length >= 32);
}

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return base64url(values);
}

export async function codeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export async function verifyGoogleIdToken(idToken: string, expectedNonce: string): Promise<PrivateUser> {
  const config = authConfig();
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, { issuer: GOOGLE_ISSUERS, audience: config.clientId });
  if (payload.nonce !== expectedNonce) throw new Error("Invalid OAuth nonce");
  if (payload.email_verified !== true || typeof payload.email !== "string") throw new Error("Google account email is not verified");
  const email = payload.email.toLowerCase();
  if (!config.allowedEmails.includes(email)) throw new Error("Account not authorized");
  return { email, name: typeof payload.name === "string" ? payload.name : email, picture: typeof payload.picture === "string" ? payload.picture : undefined };
}

export async function signPrivateSession(user: PrivateUser) {
  const secret = new TextEncoder().encode(authConfig().sessionSecret);
  return new SignJWT({ email: user.email, name: user.name, picture: user.picture })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function privateUserFromCookie(cookieHeader: string | null): Promise<PrivateUser | null> {
  if (!authIsConfigured()) return null;
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(authConfig().sessionSecret);
    const { payload } = await jwtVerify(token, secret, { issuer: SESSION_ISSUER, algorithms: ["HS256"] });
    if (typeof payload.email !== "string" || !authConfig().allowedEmails.includes(payload.email.toLowerCase())) return null;
    return { email: payload.email, name: typeof payload.name === "string" ? payload.name : payload.email, picture: typeof payload.picture === "string" ? payload.picture : undefined };
  } catch { return null; }
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const item = cookieHeader.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

export function cookie(name: string, value: string, maxAge: number, sameSite: "Lax" | "Strict" = "Lax") {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

export const authCookies = {
  state: "valf_oauth_state",
  nonce: "valf_oauth_nonce",
  verifier: "valf_oauth_verifier",
  session: SESSION_COOKIE,
};

function base64url(value: Uint8Array) {
  let binary = "";
  value.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
