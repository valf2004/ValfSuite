import postgres, { type Sql } from "postgres";
import { availabilityEvents, availabilityQuotes, availabilityRequests } from "./schema";

export type AvailabilityStatus = "quote_requested" | "quote_sent" | "payment_reported" | "accepted" | "checked_in" | "police_registered" | "archived";
export type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
export type PaymentMethod = "bank_transfer" | "paypal";
export type AvailabilityRecord = typeof availabilityRequests.$inferSelect;
export type NewAvailabilityRecord = typeof availabilityRequests.$inferInsert;
export type AvailabilityEvent = typeof availabilityEvents.$inferSelect;
type NewAvailabilityEvent = Pick<AvailabilityEvent,"requestId"|"eventType"|"createdAt"> & Partial<Omit<AvailabilityEvent,"id"|"requestId"|"eventType"|"createdAt">> & { id?:string };

export type PublicQuote = {
  quoteId:string; requestId:string; name:string; email:string; arrivalDate:string; departureDate:string;
  guestCount:number; language:string; amountCents:number; confirmedAmountCents:number; status:AvailabilityStatus;
};
export type SentQuote = { id:string; requestId:string; amountCents:number; subject:string; body:string; tokenHash:string; actorEmail?:string };
export type PaymentConfirmationInput = { requestId:string; amountCents:number; subject:string; body:string; actorEmail:string; fullyPaid:boolean };
export type PaymentSubmissionInput = {
  id:string; quoteId:string; requestId:string; method:PaymentMethod; paidAmountCents:number; paidAt:string;
  paymentReference:string; message:string; receiptKey:string|null; receiptName:string|null;
  receiptContentType:string|null; receiptSize:number|null; createdAt:string;
};

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required in the Docker runtime");
const sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
let schemaReady: Promise<void> | null = null;
const ready = () => schemaReady ??= initializePostgres(sql);

export async function createAvailabilityRequest(record: NewAvailabilityRecord) {
  await ready();
  const createdAt = record.createdAt ?? new Date().toISOString();
  const updatedAt = record.updatedAt ?? createdAt;
  await sql`INSERT INTO availability_requests
    (id,status,archive_outcome,name,email,arrival_date,departure_date,guest_count,message,language,privacy_accepted_at,created_at,updated_at)
    VALUES (${record.id},${record.status ?? "quote_requested"},${record.archiveOutcome ?? null},${record.name},${record.email},${record.arrivalDate},${record.departureDate},${record.guestCount},${record.message ?? ""},${record.language ?? "it"},${record.privacyAcceptedAt},${createdAt},${updatedAt})`;
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

export async function recordSentQuote(quote:SentQuote) {
  await ready();
  const createdAt = new Date().toISOString();
  await sql`UPDATE availability_quotes SET active=false WHERE request_id=${quote.requestId}`;
  await sql`INSERT INTO availability_quotes (id,request_id,amount_cents,subject,body,token_hash,active,created_at) VALUES (${quote.id},${quote.requestId},${quote.amountCents},${quote.subject},${quote.body},${quote.tokenHash},true,${createdAt})`;
  const rows = await sql`UPDATE availability_requests SET status='quote_sent',archive_outcome=NULL,quote_amount_cents=${quote.amountCents},quote_subject=${quote.subject},quote_body=${quote.body},quote_sent_at=${createdAt},updated_at=${createdAt} WHERE id=${quote.requestId} RETURNING *`;
  if(rows.length) await insertEvent({requestId:quote.requestId,eventType:"email_sent",toStatus:"quote_sent",actorEmail:quote.actorEmail??null,note:"Preventivo inviato al cliente",subject:quote.subject,body:quote.body,amountCents:quote.amountCents,createdAt});
  return rows.map(mapRow);
}

export async function recordPaymentConfirmation(input:PaymentConfirmationInput) {
  await ready();
  const current=await sql`SELECT status FROM availability_requests WHERE id=${input.requestId}`;
  const createdAt=new Date().toISOString();
  if(input.fullyPaid)await sql`UPDATE availability_quotes SET active=false WHERE request_id=${input.requestId}`;
  const rows=await sql`UPDATE availability_requests SET status='accepted',archive_outcome=NULL,updated_at=${createdAt} WHERE id=${input.requestId} RETURNING *`;
  if(rows.length)await insertEvent({requestId:input.requestId,eventType:"payment_confirmed",fromStatus:current[0]?.status==null?null:String(current[0].status),toStatus:"accepted",actorEmail:input.actorEmail,note:"Pagamento verificato e conferma inviata al cliente",subject:input.subject,body:input.body,amountCents:input.amountCents,createdAt});
  return rows.map(mapRow);
}

export async function findActiveQuoteByTokenHash(tokenHash:string):Promise<PublicQuote|null> {
  await ready();
  const rows=await sql`SELECT q.id AS quote_id,q.request_id,q.amount_cents,r.name,r.email,r.arrival_date,r.departure_date,r.guest_count,r.language,r.status,COALESCE((SELECT SUM(e.amount_cents) FROM availability_events e WHERE e.request_id=q.request_id AND e.event_type='payment_confirmed'),0) AS confirmed_amount_cents FROM availability_quotes q JOIN availability_requests r ON r.id=q.request_id WHERE q.token_hash=${tokenHash} AND q.active=true LIMIT 1`;
  if(!rows.length)return null;
  const row=rows[0];
  return {quoteId:String(row.quote_id),requestId:String(row.request_id),name:String(row.name),email:String(row.email),arrivalDate:dateValue(row.arrival_date),departureDate:dateValue(row.departure_date),guestCount:Number(row.guest_count),language:String(row.language),amountCents:Number(row.amount_cents),confirmedAmountCents:Number(row.confirmed_amount_cents),status:String(row.status) as AvailabilityStatus};
}

export async function createPaymentSubmission(input:PaymentSubmissionInput) {
  await ready();
  const current=await sql`SELECT status FROM availability_requests WHERE id=${input.requestId}`;
  await sql`INSERT INTO payment_submissions (id,quote_id,request_id,method,paid_amount_cents,paid_at,payment_reference,message,receipt_key,receipt_name,receipt_content_type,receipt_size,created_at) VALUES (${input.id},${input.quoteId},${input.requestId},${input.method},${input.paidAmountCents},${input.paidAt},${input.paymentReference},${input.message},${input.receiptKey},${input.receiptName},${input.receiptContentType},${input.receiptSize},${input.createdAt})`;
  const rows=await sql`UPDATE availability_requests SET status='payment_reported',archive_outcome=NULL,updated_at=${input.createdAt} WHERE id=${input.requestId} RETURNING *`;
  const methodLabel=input.method==="paypal"?"PayPal":"bonifico bancario";
  const reference=input.paymentReference?` · Riferimento: ${input.paymentReference}`:"";
  await insertEvent({id:crypto.randomUUID(),requestId:input.requestId,eventType:"payment_reported",fromStatus:current[0]?.status==null?null:String(current[0].status),toStatus:"payment_reported",note:`Pagamento comunicato tramite ${methodLabel} · Data: ${input.paidAt}${reference}`,body:input.message||null,amountCents:input.paidAmountCents,attachmentId:input.receiptKey?input.id:null,attachmentName:input.receiptName,createdAt:input.createdAt});
  return rows.map(mapRow);
}

export async function getPaymentReceipt(id:string) {
  await ready();
  const rows=await sql`SELECT receipt_key,receipt_name,receipt_content_type,receipt_size FROM payment_submissions WHERE id=${id} LIMIT 1`;
  if(!rows.length||rows[0].receipt_key==null)return null;
  return {key:String(rows[0].receipt_key),name:String(rows[0].receipt_name||"ricevuta"),contentType:String(rows[0].receipt_content_type||"application/octet-stream"),size:rows[0].receipt_size==null?null:Number(rows[0].receipt_size)};
}

export async function recordAvailabilityEvent(event:NewAvailabilityEvent){await ready();await insertEvent(event);return event;}
export async function listAvailabilityEvents(){await ready();const rows=await sql`SELECT * FROM availability_events ORDER BY created_at ASC`;return rows.map(mapEventRow);}

async function initializePostgres(client: Sql) {
  await client`CREATE TABLE IF NOT EXISTS availability_requests (
    id text PRIMARY KEY,status text NOT NULL DEFAULT 'quote_requested',archive_outcome text,
    name text NOT NULL,email text NOT NULL,arrival_date date NOT NULL,departure_date date NOT NULL,
    guest_count integer NOT NULL CHECK (guest_count BETWEEN 1 AND 4),message text NOT NULL DEFAULT '',language text NOT NULL DEFAULT 'it',
    privacy_accepted_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK (departure_date > arrival_date))`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS archive_outcome text`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_amount_cents integer`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_subject text`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_body text`;
  await client`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz`;
  await client`CREATE TABLE IF NOT EXISTS availability_events (id text PRIMARY KEY,request_id text NOT NULL REFERENCES availability_requests(id) ON DELETE CASCADE,event_type text NOT NULL,from_status text,to_status text,actor_email text,note text,subject text,body text,amount_cents integer,attachment_id text,attachment_name text,created_at timestamptz NOT NULL DEFAULT now())`;
  await client`ALTER TABLE availability_events ADD COLUMN IF NOT EXISTS attachment_id text`;
  await client`ALTER TABLE availability_events ADD COLUMN IF NOT EXISTS attachment_name text`;
  await client`CREATE TABLE IF NOT EXISTS availability_quotes (id text PRIMARY KEY,request_id text NOT NULL REFERENCES availability_requests(id) ON DELETE CASCADE,amount_cents integer NOT NULL,subject text NOT NULL,body text NOT NULL,token_hash text NOT NULL UNIQUE,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now())`;
  await client`CREATE TABLE IF NOT EXISTS payment_submissions (id text PRIMARY KEY,quote_id text NOT NULL REFERENCES availability_quotes(id) ON DELETE CASCADE,request_id text NOT NULL REFERENCES availability_requests(id) ON DELETE CASCADE,method text NOT NULL CHECK (method IN ('bank_transfer','paypal')),paid_amount_cents integer NOT NULL,paid_at date NOT NULL,payment_reference text NOT NULL DEFAULT '',message text NOT NULL DEFAULT '',receipt_key text,receipt_name text,receipt_content_type text,receipt_size integer,created_at timestamptz NOT NULL DEFAULT now())`;
  await client`ALTER TABLE availability_requests DROP CONSTRAINT IF EXISTS availability_requests_status_check`;
  await client`ALTER TABLE availability_requests DROP CONSTRAINT IF EXISTS availability_requests_archive_outcome_check`;
  await client`UPDATE availability_requests SET status=CASE WHEN status='new' THEN 'quote_requested' WHEN status='contacted' THEN 'quote_sent' WHEN status='confirmed' THEN 'accepted' WHEN status='declined' THEN 'archived' ELSE status END`;
  await client`UPDATE availability_requests SET archive_outcome='unavailable' WHERE status='archived' AND archive_outcome IS NULL`;
  await client`ALTER TABLE availability_requests ADD CONSTRAINT availability_requests_status_check CHECK (status IN ('quote_requested','quote_sent','payment_reported','accepted','checked_in','police_registered','archived'))`;
  await client`ALTER TABLE availability_requests ADD CONSTRAINT availability_requests_archive_outcome_check CHECK (archive_outcome IS NULL OR archive_outcome IN ('completed','cancelled','unavailable'))`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_events_request_created ON availability_events (request_id,created_at)`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_quotes_request_active ON availability_quotes (request_id,active)`;
  await client`CREATE INDEX IF NOT EXISTS idx_payment_submissions_request_created ON payment_submissions (request_id,created_at)`;
  await client`CREATE INDEX IF NOT EXISTS idx_payment_submissions_quote ON payment_submissions (quote_id)`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_requests_status_created ON availability_requests (status,created_at DESC)`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_requests_arrival ON availability_requests (arrival_date)`;
}

function mapRow(row: Record<string, unknown>): AvailabilityRecord {
  const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);
  return {id:String(row.id),status:String(row.status) as AvailabilityStatus,archiveOutcome:row.archive_outcome?String(row.archive_outcome) as ArchiveOutcome:null,name:String(row.name),email:String(row.email),arrivalDate:dateValue(row.arrival_date),departureDate:dateValue(row.departure_date),guestCount:Number(row.guest_count),message:String(row.message??""),language:String(row.language),quoteAmountCents:row.quote_amount_cents==null?null:Number(row.quote_amount_cents),quoteSubject:row.quote_subject==null?null:String(row.quote_subject),quoteBody:row.quote_body==null?null:String(row.quote_body),quoteSentAt:row.quote_sent_at==null?null:iso(row.quote_sent_at),privacyAcceptedAt:iso(row.privacy_accepted_at),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};
}

async function archiveCompletedStays(){await sql`UPDATE availability_requests SET status='archived',archive_outcome='completed',updated_at=now() WHERE status='police_registered' AND departure_date < CURRENT_DATE`;}
async function insertEvent(event:NewAvailabilityEvent){await sql`INSERT INTO availability_events (id,request_id,event_type,from_status,to_status,actor_email,note,subject,body,amount_cents,attachment_id,attachment_name,created_at) VALUES (${event.id??crypto.randomUUID()},${event.requestId},${event.eventType},${event.fromStatus??null},${event.toStatus??null},${event.actorEmail??null},${event.note??null},${event.subject??null},${event.body??null},${event.amountCents??null},${event.attachmentId??null},${event.attachmentName??null},${event.createdAt})`;}
function mapEventRow(row:Record<string,unknown>):AvailabilityEvent{const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);return{id:String(row.id),requestId:String(row.request_id),eventType:String(row.event_type) as AvailabilityEvent["eventType"],fromStatus:row.from_status==null?null:String(row.from_status),toStatus:row.to_status==null?null:String(row.to_status),actorEmail:row.actor_email==null?null:String(row.actor_email),note:row.note==null?null:String(row.note),subject:row.subject==null?null:String(row.subject),body:row.body==null?null:String(row.body),amountCents:row.amount_cents==null?null:Number(row.amount_cents),attachmentId:row.attachment_id==null?null:String(row.attachment_id),attachmentName:row.attachment_name==null?null:String(row.attachment_name),createdAt:iso(row.created_at)};}
function dateValue(value:unknown){return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);}
