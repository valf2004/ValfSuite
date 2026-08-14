import postgres, { type Sql } from "postgres";
import { availabilityRequests } from "./schema";

export type AvailabilityStatus = "quote_requested" | "quote_sent" | "accepted" | "checked_in" | "police_registered" | "archived";
export type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
export type AvailabilityRecord = typeof availabilityRequests.$inferSelect;
export type NewAvailabilityRecord = typeof availabilityRequests.$inferInsert;

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

export async function updateAvailabilityStatus(id: string, status: AvailabilityStatus, archiveOutcome: ArchiveOutcome | null = null) {
  await ready();
  const rows = await sql`UPDATE availability_requests SET status=${status},archive_outcome=${archiveOutcome},updated_at=${new Date().toISOString()} WHERE id=${id} RETURNING *`;
  return rows.map(mapRow);
}

export async function updateAvailabilityQuote(id: string, quoteAmountCents: number, quoteSubject: string, quoteBody: string) {
  await ready();
  const quoteSentAt = new Date().toISOString();
  const rows = await sql`UPDATE availability_requests SET status='quote_sent',archive_outcome=NULL,quote_amount_cents=${quoteAmountCents},quote_subject=${quoteSubject},quote_body=${quoteBody},quote_sent_at=${quoteSentAt},updated_at=${quoteSentAt} WHERE id=${id} RETURNING *`;
  return rows.map(mapRow);
}

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
