import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../../db";
import { availabilityRequests } from "../../../../db/schema";
import { privateUserFromCookie } from "../../../lib/google-auth";

const statuses = ["new", "contacted", "confirmed", "declined", "archived"] as const;
type RequestStatus = typeof statuses[number];

async function authorizedUser() {
  const requestHeaders = await headers();
  return privateUserFromCookie(requestHeaders.get("cookie"));
}

export async function GET(request: Request) {
  if (!await authorizedUser()) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  const db = getDb();
  const rows = status && statuses.includes(status as RequestStatus)
    ? await db.select().from(availabilityRequests).where(eq(availabilityRequests.status, status as RequestStatus)).orderBy(desc(availabilityRequests.createdAt))
    : await db.select().from(availabilityRequests).orderBy(desc(availabilityRequests.createdAt));
  return Response.json({ requests: rows });
}

export async function PATCH(request: Request) {
  const user = await authorizedUser();
  if (!user) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });
  const data = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  if (!data || typeof data.id !== "string" || typeof data.status !== "string" || !statuses.includes(data.status as RequestStatus)) {
    return Response.json({ message: "Aggiornamento non valido." }, { status: 400 });
  }
  const result = await getDb().update(availabilityRequests)
    .set({ status: data.status as RequestStatus, updatedAt: new Date().toISOString() })
    .where(eq(availabilityRequests.id, data.id)).returning();
  if (!result.length) return Response.json({ message: "Richiesta non trovata." }, { status: 404 });
  return Response.json({ request: result[0], updatedBy: user.email });
}
