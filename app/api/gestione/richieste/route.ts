import { headers } from "next/headers";
import { listAvailabilityEvents, listAvailabilityRequests, updateAvailabilityStatus, type AvailabilityStatus } from "../../../../db/availability";
import { privateUserFromCookie } from "../../../lib/google-auth";

const statuses = ["quote_requested", "quote_sent", "payment_reported", "accepted", "checked_in", "police_registered", "archived"] as const;
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
  const data = await request.json().catch(() => null) as { id?: unknown; status?: unknown; archiveOutcome?: unknown; note?: unknown; force?:unknown } | null;
  if (!data || typeof data.id !== "string" || typeof data.status !== "string" || !statuses.includes(data.status as RequestStatus) || (data.status === "archived" && (typeof data.archiveOutcome !== "string" || !outcomes.includes(data.archiveOutcome as typeof outcomes[number])))) {
    return Response.json({ message: "Aggiornamento non valido." }, { status: 400 });
  }
  let note = typeof data.note === "string" ? data.note.trim().slice(0, 10000) : "";
  if(data.status==="accepted"){
    const rows=await listAvailabilityRequests();
    const target=rows.find(item=>item.id===data.id);
    if(!target)return Response.json({message:"Richiesta non trovata."},{status:404});
    const blockingStatuses:AvailabilityStatus[]=["accepted","checked_in","police_registered"];
    const conflicts=rows.filter(item=>item.id!==target.id&&blockingStatuses.includes(item.status)&&target.arrivalDate<item.departureDate&&target.departureDate>item.arrivalDate).map(item=>({id:item.id,name:item.name,arrivalDate:item.arrivalDate,departureDate:item.departureDate,status:item.status}));
    if(conflicts.length&&data.force!==true)return Response.json({message:"Esiste già una prenotazione confermata nello stesso periodo.",conflicts},{status:409});
    if(conflicts.length)note=[note,`Sovrapposizione confermata manualmente con: ${conflicts.map(item=>`${item.name} (${item.arrivalDate}–${item.departureDate})`).join(", ")}.`].filter(Boolean).join("\n\n").slice(0,10000);
  }
  const result = await updateAvailabilityStatus(data.id, data.status as AvailabilityStatus, data.status === "archived" ? data.archiveOutcome as "completed"|"cancelled"|"unavailable" : null, user.email, note);
  if (!result.length) return Response.json({ message: "Richiesta non trovata." }, { status: 404 });
  const event = (await listAvailabilityEvents()).filter(item=>item.requestId===data.id).at(-1);
  return Response.json({ request: result[0], event, updatedBy: user.email });
}
