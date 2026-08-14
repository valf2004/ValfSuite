import { headers } from "next/headers";
import { listAvailabilityEvents, listAvailabilityRequests, updateAvailabilityStatus, type AvailabilityStatus } from "../../../../db/availability";
import { privateUserFromCookie } from "../../../lib/google-auth";

const statuses = ["quote_requested", "quote_sent", "accepted", "checked_in", "police_registered", "archived"] as const;
const outcomes = ["completed", "cancelled", "unavailable"] as const;
type RequestStatus = typeof statuses[number];

async function authorizedUser() {
  const requestHeaders = await headers();
  return privateUserFromCookie(requestHeaders.get("cookie"));
}

export async function GET(request: Request) {
  if (!await authorizedUser()) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  const rows = await listAvailabilityRequests(status && statuses.includes(status as RequestStatus) ? status as AvailabilityStatus : undefined);
  return Response.json({ requests: rows });
}

export async function PATCH(request: Request) {
  const user = await authorizedUser();
  if (!user) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });
  const data = await request.json().catch(() => null) as { id?: unknown; status?: unknown; archiveOutcome?: unknown; note?: unknown } | null;
  if (!data || typeof data.id !== "string" || typeof data.status !== "string" || !statuses.includes(data.status as RequestStatus) || (data.status === "archived" && (typeof data.archiveOutcome !== "string" || !outcomes.includes(data.archiveOutcome as typeof outcomes[number])))) {
    return Response.json({ message: "Aggiornamento non valido." }, { status: 400 });
  }
  const note = typeof data.note === "string" ? data.note.trim().slice(0, 10000) : "";
  const result = await updateAvailabilityStatus(data.id, data.status as AvailabilityStatus, data.status === "archived" ? data.archiveOutcome as "completed"|"cancelled"|"unavailable" : null, user.email, note);
  if (!result.length) return Response.json({ message: "Richiesta non trovata." }, { status: 404 });
  const event = (await listAvailabilityEvents()).filter(item=>item.requestId===data.id).at(-1);
  return Response.json({ request: result[0], event, updatedBy: user.email });
}
