import { headers } from "next/headers";
import { createAvailabilityRequest, listAvailabilityEvents, listAvailabilityRequests, recordAvailabilityEvent, updateAvailabilityStatus, type AvailabilityStatus } from "../../../../db/availability";
import { privateUserFromCookie } from "../../../lib/google-auth";
import { todayAtProperty } from "../../../lib/property-date";

const statuses = ["quote_requested", "quote_sent", "accepted", "checked_in", "police_registered", "archived"] as const;
const outcomes = ["completed", "cancelled", "unavailable"] as const;
type RequestStatus = typeof statuses[number];

async function authorizedUser() {
  const requestHeaders = await headers();
  return privateUserFromCookie(requestHeaders.get("cookie"));
}

function isIsoDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T12:00:00Z`);return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;}

export async function GET(request: Request) {
  if (!await authorizedUser()) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status");
  const rows = await listAvailabilityRequests(status && statuses.includes(status as RequestStatus) ? status as AvailabilityStatus : undefined);
  return Response.json({ requests: rows });
}

export async function POST(request: Request) {
  const user = await authorizedUser();
  if (!user) return Response.json({ message: "Accesso non autorizzato." }, { status: 401 });
  const data = await request.json().catch(() => null) as { sourceId?:unknown; relationReason?:unknown; arrivalDate?:unknown; departureDate?:unknown; guestCount?:unknown; note?:unknown } | null;
  const reasons = ["new_stay", "stay_change"] as const;
  if (!data || typeof data.sourceId !== "string" || typeof data.relationReason !== "string" || !reasons.includes(data.relationReason as typeof reasons[number]) || typeof data.arrivalDate !== "string" || typeof data.departureDate !== "string") return Response.json({ message: "Controlla i dati della nuova pratica." }, { status: 400 });
  const guestCount = Number(data.guestCount);
  if (!isIsoDate(data.arrivalDate) || !isIsoDate(data.departureDate) || data.arrivalDate < todayAtProperty() || data.departureDate <= data.arrivalDate || !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 4) return Response.json({ message: "Controlla le date e il numero degli ospiti." }, { status: 400 });
  const source = (await listAvailabilityRequests()).find(item => item.id === data.sourceId);
  if (!source) return Response.json({ message: "Pratica di origine non trovata." }, { status: 404 });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const relationReason = data.relationReason as typeof reasons[number];
  const note = typeof data.note === "string" ? data.note.trim().slice(0, 2000) : "";
  await createAvailabilityRequest({ id, status:"quote_requested", paymentStatus:"unpaid", sourceRequestId:source.id, relationReason, name:source.name, email:source.email, arrivalDate:data.arrivalDate, departureDate:data.departureDate, guestCount, message:note, language:source.language, privacyAcceptedAt:source.privacyAcceptedAt, createdAt:now, updatedAt:now });
  const relationLabel = relationReason === "stay_change" ? "Variazione soggiorno" : "Nuovo soggiorno";
  const createdEvent = await recordAvailabilityEvent({ requestId:id, eventType:"request_created", toStatus:"quote_requested", actorEmail:user.email, note:relationLabel+" collegato alla pratica precedente · "+data.arrivalDate+"–"+data.departureDate+(note?"\n\n"+note:""), createdAt:now });
  const sourceEvent = await recordAvailabilityEvent({ requestId:source.id, eventType:"related_request_created", fromStatus:source.status, toStatus:source.status, actorEmail:user.email, note:relationLabel+" creato per il periodo "+data.arrivalDate+"–"+data.departureDate+". La pratica originale resta invariata.", createdAt:now });
  const created = (await listAvailabilityRequests()).find(item => item.id === id);
  if (!created) return Response.json({ message:"Creazione non completata." }, { status:500 });
  return Response.json({ request:created, events:[createdEvent,sourceEvent] }, { status:201 });
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
