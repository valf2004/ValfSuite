import postgres, { type Sql } from "postgres";
import { availabilityEvents, availabilityRequests } from "./schema";

export type AvailabilityStatus = "quote_requested" | "quote_sent" | "accepted" | "checked_in" | "police_registered" | "archived";
export type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
export type AvailabilityRecord = typeof availabilityRequests.$inferSelect;
export type NewAvailabilityRecord = typeof availabilityRequests.$inferInsert;
export type AvailabilityEvent = typeof availabilityEvents.$inferSelect;
type NewAvailabilityEvent = Pick<AvailabilityEvent,"requestId"|"eventType"|"createdAt"> & Partial<Omit<AvailabilityEvent,"id"|"requestId"|"eventType"|"createdAt">> & { id?:string };

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required in the Docker runtime");
const sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
let schemaReady: Promise<void> | null = null;
const ready = () => schemaReady ??= initializePostgres(sql);

export async function createAvailabilityRequest(record: NewAvailabilityRecord) {
  await ready();
  await sql`INSERT INTO availability_requests
    (id,status,archive_outcome,name,email,arrival_date,departure_date,guest_count,message,language,privacy_accepted_at,created_at,updated_at)
    VALUES (${record.id},${record.status ?? "quote_requested"},${record.archiveOutcome ?? null},${record.name},${record.email},${record.arrivalDate},${record.departureDate},${record.guestCount},${record.message ?? ""},${record.language ?? "it"},${record.privacyAcceptedAt},${record.createdAt},${record.updatedAt})`;
}

export async function listAvailabilityRequests(status?: AvailabilityStatus) {
  await ready();
  await archiveCompletedStays();
  const rows = status ? await sql`SELECT * FROM availability_requests WHERE status=${status} ORDER BY created_at DESC` : await sql`SELECT * FROM availability_requests ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function updateAvailabilityStatus(id: string, status: AvailabilityStatus, archiveOutcome: ArchiveOutcome | null = null, actorEmail?: string, note?: string) {
  await ready();
  const current=await sql`SELECT status FROM availability_requests WHERE id=${id}`;
  const updatedAt=new Date().toISOString();
  const rows = await sql`UPDATE availability_requests SET status=${status},archive_outcome=${archiveOutcome},updated_at=${updatedAt} WHERE id=${id} RETURNING *`;
  if(rows.length) await insertEvent({requestId:id,eventType:"status_changed",fromStatus:current[0]?.status==null?null:String(current[0].status),toStatus:status,actorEmail:actorEmail??null,note:note?.trim()||null,createdAt:updatedAt});
  return rows.map(mapRow);
}

export async function updateAvailabilityQuote(id: string, quoteAmountCents: number, quoteSubject: string, quoteBody: string, actorEmail?: string) {
  await ready();
  const quoteSentAt = new Date().toISOString();
  const rows = await sql`UPDATE availability_requests SET status='quote_sent',archive_outcome=NULL,quote_amount_cents=${quoteAmountCents},quote_subject=${quoteSubject},quote_body=${quoteBody},quote_sent_at=${quoteSentAt},updated_at=${quoteSentAt} WHERE id=${id} RETURNING *`;
  if(rows.length) await insertEvent({requestId:id,eventType:"email_sent",toStatus:"quote_sent",actorEmail:actorEmail??null,note:"Preventivo inviato al cliente",subject:quoteSubject,body:quoteBody,amountCents:quoteAmountCents,createdAt:quoteSentAt});
  return rows.map(mapRow);
}

export async function recordAvailabilityEvent(event:NewAvailabilityEvent){await ready();await insertEvent(event);return event;}
export async function listAvailabilityEvents(){await ready();const rows=await sql`SELECT * FROM availability_events ORDER BY created_at ASC`;return rows.map(mapEventRow);}

async function initializePostgres(client: Sql) {
  await client`CREATE TABLE IF NOT EXISTS availability_requests (
    id text PRIMARY KEY,
    status text NOT NULL DEFAULT 'quote_requested', archive_outcome text,
    name text NOT NULL,email text NOT NULL,arrival_date date NOT NULL,departure_date date NOT NULL,
    guest_count integer NOT NULL CHECK (guest_count BETWEEN 1 AND 4),message text NOT NULL DEFAULT '',language text NOT NULL DEFAULT 'it',
    privacy_accepted_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (departure_date > arrival_date))`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS archive_outcome text`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_amount_cents integer`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_subject text`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_body text`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz`;
  await client`CREATE TABLE IF NOT EXISTS availability_events (id text PRIMARY KEY,request_id text NOT NULL REFERENCES availability_requests(id) ON DELETE CASCADE,event_type text NOT NULL,from_status text,to_status text,actor_email text,note text,subject text,body text,amount_cents integer,created_at timestamptz NOT NULL DEFAULT now())`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_events_request_created ON availability_events (request_id,created_at)`;
  await client`ALTER TABLE availability_requests DROP CONSTRAINT IF EXISTS availability_requests_status_check`;
  await client`ALTER TABLE availability_requests DROP CONSTRAINT IF EXISTS availability_requests_archive_outcome_check`;
  await client`UPDATE availability_requests SET status=CASE WHEN status='new' THEN 'quote_requested' WHEN status='contacted' THEN 'quote_sent' WHEN status='confirmed' THEN 'accepted' WHEN status='declined' THEN 'archived' ELSE status END`;
  await client`UPDATE availability_requests SET archive_outcome='unavailable' WHERE status='archived' AND archive_outcome IS NULL`;
  await client`ALTER TABLE availability_requests ADD CONSTRAINT availability_requests_status_check CHECK (status IN ('quote_requested','quote_sent','accepted','checked_in','police_registered','archived'))`;
  await client`ALTER TABLE availability_requests ADD CONSTRAINT availability_requests_archive_outcome_check CHECK (archive_outcome IS NULL OR archive_outcome IN ('completed','cancelled','unavailable'))`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_requests_status_created ON availability_requests (status,created_at DESC)`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_requests_arrival ON availability_requests (arrival_date)`;
}

function mapRow(row: Record<string, unknown>): AvailabilityRecord {
  const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);
  const date=(value:unknown)=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
  return {id:String(row.id),status:String(row.status) as AvailabilityStatus,archiveOutcome:row.archive_outcome?String(row.archive_outcome) as ArchiveOutcome:null,name:String(row.name),email:String(row.email),arrivalDate:date(row.arrival_date),departureDate:date(row.departure_date),guestCount:Number(row.guest_count),message:String(row.message??""),language:String(row.language),quoteAmountCents:row.quote_amount_cents==null?null:Number(row.quote_amount_cents),quoteSubject:row.quote_subject==null?null:String(row.quote_subject),quoteBody:row.quote_body==null?null:String(row.quote_body),quoteSentAt:row.quote_sent_at==null?null:iso(row.quote_sent_at),privacyAcceptedAt:iso(row.privacy_accepted_at),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};
}

async function archiveCompletedStays(){await sql`UPDATE availability_requests SET status='archived',archive_outcome='completed',updated_at=now() WHERE status='police_registered' AND departure_date < CURRENT_DATE`;}
async function insertEvent(event:NewAvailabilityEvent){await sql`INSERT INTO availability_events (id,request_id,event_type,from_status,to_status,actor_email,note,subject,body,amount_cents,created_at) VALUES (${event.id??crypto.randomUUID()},${event.requestId},${event.eventType},${event.fromStatus??null},${event.toStatus??null},${event.actorEmail??null},${event.note??null},${event.subject??null},${event.body??null},${event.amountCents??null},${event.createdAt})`;}
function mapEventRow(row:Record<string,unknown>):AvailabilityEvent{const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);return{id:String(row.id),requestId:String(row.request_id),eventType:String(row.event_type) as AvailabilityEvent["eventType"],fromStatus:row.from_status==null?null:String(row.from_status),toStatus:row.to_status==null?null:String(row.to_status),actorEmail:row.actor_email==null?null:String(row.actor_email),note:row.note==null?null:String(row.note),subject:row.subject==null?null:String(row.subject),body:row.body==null?null:String(row.body),amountCents:row.amount_cents==null?null:Number(row.amount_cents),createdAt:iso(row.created_at)};}
