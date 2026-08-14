import { asc, desc, eq } from "drizzle-orm";
import postgres, { type Sql } from "postgres";
import { availabilityEvents, availabilityRequests } from "./schema";

export type AvailabilityStatus = "quote_requested" | "quote_sent" | "accepted" | "checked_in" | "police_registered" | "archived";
export type ArchiveOutcome = "completed" | "cancelled" | "unavailable";
export type AvailabilityRecord = typeof availabilityRequests.$inferSelect;
export type NewAvailabilityRecord = typeof availabilityRequests.$inferInsert;
export type AvailabilityEvent = typeof availabilityEvents.$inferSelect;
type NewAvailabilityEvent = Pick<AvailabilityEvent,"requestId"|"eventType"|"createdAt"> & Partial<Omit<AvailabilityEvent,"id"|"requestId"|"eventType"|"createdAt">> & { id?:string };

let sqlClient: Sql | null = null;
let schemaReady: Promise<void> | null = null;

function postgresClient() {
  const url = process.env["DATABASE_URL"]?.trim();
  if (!url) return null;
  sqlClient ??= postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  schemaReady ??= initializePostgres(sqlClient);
  return { sql: sqlClient, ready: schemaReady };
}

export async function createAvailabilityRequest(record: NewAvailabilityRecord) {
  const pg = postgresClient();
  if (!pg) {
    const { getDb } = await import(".");
    return getDb().insert(availabilityRequests).values(record);
  }
  await pg.ready;
  await pg.sql`
    INSERT INTO availability_requests
      (id, status, name, email, arrival_date, departure_date, guest_count, message, language, privacy_accepted_at, created_at, updated_at)
    VALUES
      (${record.id}, ${record.status ?? "quote_requested"}, ${record.name}, ${record.email}, ${record.arrivalDate}, ${record.departureDate}, ${record.guestCount}, ${record.message ?? ""}, ${record.language ?? "it"}, ${record.privacyAcceptedAt}, ${record.createdAt}, ${record.updatedAt})
  `;
}

export async function listAvailabilityRequests(status?: AvailabilityStatus) {
  const pg = postgresClient();
  if (!pg) {
    const { getDb } = await import(".");
    const today = new Date().toISOString().slice(0,10);
    const completed = await getDb().select().from(availabilityRequests).where(eq(availabilityRequests.status,"police_registered"));
    await Promise.all(completed.filter(item=>item.departureDate<today).map(item=>getDb().update(availabilityRequests).set({status:"archived",archiveOutcome:"completed",updatedAt:new Date().toISOString()}).where(eq(availabilityRequests.id,item.id))));
    return status
      ? getDb().select().from(availabilityRequests).where(eq(availabilityRequests.status, status)).orderBy(desc(availabilityRequests.createdAt))
      : getDb().select().from(availabilityRequests).orderBy(desc(availabilityRequests.createdAt));
  }
  await pg.ready;
  const rows = status
    ? await pg.sql`SELECT * FROM availability_requests WHERE status = ${status} ORDER BY created_at DESC`
    : await pg.sql`SELECT * FROM availability_requests ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function updateAvailabilityStatus(id: string, status: AvailabilityStatus, archiveOutcome: ArchiveOutcome | null = null, actorEmail?: string, note?: string) {
  const updatedAt = new Date().toISOString();
  const pg = postgresClient();
  if (!pg) {
    const { getDb } = await import(".");
    const current = await getDb().select().from(availabilityRequests).where(eq(availabilityRequests.id, id));
    const updated = await getDb().update(availabilityRequests).set({ status, archiveOutcome, updatedAt }).where(eq(availabilityRequests.id, id)).returning();
    if (updated.length) await recordAvailabilityEvent({ requestId:id, eventType:"status_changed", fromStatus:current[0]?.status ?? null, toStatus:status, actorEmail:actorEmail ?? null, note:note?.trim() || null, createdAt:updatedAt });
    return updated;
  }
  await pg.ready;
  const current = await pg.sql`SELECT status FROM availability_requests WHERE id=${id}`;
  const rows = await pg.sql`UPDATE availability_requests SET status = ${status}, archive_outcome=${archiveOutcome}, updated_at = ${updatedAt} WHERE id = ${id} RETURNING *`;
  if (rows.length) await insertPostgresEvent(pg.sql, { requestId:id, eventType:"status_changed", fromStatus:current[0]?.status == null ? null : String(current[0].status), toStatus:status, actorEmail:actorEmail ?? null, note:note?.trim() || null, createdAt:updatedAt });
  return rows.map(mapRow);
}

export async function updateAvailabilityQuote(id: string, quoteAmountCents: number, quoteSubject: string, quoteBody: string, actorEmail?: string) {
  const quoteSentAt = new Date().toISOString();
  const pg = postgresClient();
  if (!pg) {
    const { getDb } = await import(".");
    const updated = await getDb().update(availabilityRequests).set({ status: "quote_sent", archiveOutcome: null, quoteAmountCents, quoteSubject, quoteBody, quoteSentAt, updatedAt: quoteSentAt }).where(eq(availabilityRequests.id, id)).returning();
    if (updated.length) await recordAvailabilityEvent({ requestId:id, eventType:"email_sent", fromStatus:null, toStatus:"quote_sent", actorEmail:actorEmail ?? null, note:"Preventivo inviato al cliente", subject:quoteSubject, body:quoteBody, amountCents:quoteAmountCents, createdAt:quoteSentAt });
    return updated;
  }
  await pg.ready;
  const rows = await pg.sql`UPDATE availability_requests SET status='quote_sent', archive_outcome=NULL, quote_amount_cents=${quoteAmountCents}, quote_subject=${quoteSubject}, quote_body=${quoteBody}, quote_sent_at=${quoteSentAt}, updated_at=${quoteSentAt} WHERE id=${id} RETURNING *`;
  if (rows.length) await insertPostgresEvent(pg.sql, { requestId:id, eventType:"email_sent", fromStatus:null, toStatus:"quote_sent", actorEmail:actorEmail ?? null, note:"Preventivo inviato al cliente", subject:quoteSubject, body:quoteBody, amountCents:quoteAmountCents, createdAt:quoteSentAt });
  return rows.map(mapRow);
}

export async function recordAvailabilityEvent(event: NewAvailabilityEvent) {
  const record = { ...event, id:event.id ?? crypto.randomUUID() };
  const pg = postgresClient();
  if (!pg) { const { getDb } = await import("."); await getDb().insert(availabilityEvents).values(record); return record; }
  await pg.ready; await insertPostgresEvent(pg.sql, record); return record;
}

export async function listAvailabilityEvents() {
  const pg = postgresClient();
  if (!pg) { const { getDb } = await import("."); return getDb().select().from(availabilityEvents).orderBy(asc(availabilityEvents.createdAt)); }
  await pg.ready; const rows = await pg.sql`SELECT * FROM availability_events ORDER BY created_at ASC`; return rows.map(mapEventRow);
}

async function initializePostgres(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS availability_requests (
      id text PRIMARY KEY,
      status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','declined','archived')),
      name text NOT NULL,
      email text NOT NULL,
      arrival_date date NOT NULL,
      departure_date date NOT NULL,
      guest_count integer NOT NULL CHECK (guest_count BETWEEN 1 AND 4),
      message text NOT NULL DEFAULT '',
      language text NOT NULL DEFAULT 'it',
      quote_amount_cents integer,
      quote_subject text,
      quote_body text,
      quote_sent_at timestamptz,
      privacy_accepted_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (departure_date > arrival_date)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_availability_requests_status_created ON availability_requests (status, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_availability_requests_arrival ON availability_requests (arrival_date)`;
  await sql`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_amount_cents integer`;
  await sql`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_subject text`;
  await sql`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_body text`;
  await sql`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz`;
  await sql`CREATE TABLE IF NOT EXISTS availability_events (id text PRIMARY KEY,request_id text NOT NULL REFERENCES availability_requests(id) ON DELETE CASCADE,event_type text NOT NULL,from_status text,to_status text,actor_email text,note text,subject text,body text,amount_cents integer,created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS idx_availability_events_request_created ON availability_events (request_id,created_at)`;
}

async function insertPostgresEvent(client: Sql, event: NewAvailabilityEvent) { await client`INSERT INTO availability_events (id,request_id,event_type,from_status,to_status,actor_email,note,subject,body,amount_cents,created_at) VALUES (${event.id ?? crypto.randomUUID()},${event.requestId},${event.eventType},${event.fromStatus ?? null},${event.toStatus ?? null},${event.actorEmail ?? null},${event.note ?? null},${event.subject ?? null},${event.body ?? null},${event.amountCents ?? null},${event.createdAt})`; }
function mapEventRow(row:Record<string,unknown>):AvailabilityEvent { const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value); return {id:String(row.id),requestId:String(row.request_id),eventType:String(row.event_type) as AvailabilityEvent["eventType"],fromStatus:row.from_status==null?null:String(row.from_status),toStatus:row.to_status==null?null:String(row.to_status),actorEmail:row.actor_email==null?null:String(row.actor_email),note:row.note==null?null:String(row.note),subject:row.subject==null?null:String(row.subject),body:row.body==null?null:String(row.body),amountCents:row.amount_cents==null?null:Number(row.amount_cents),createdAt:iso(row.created_at)}; }

function mapRow(row: Record<string, unknown>): AvailabilityRecord {
  const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
  const date = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return {
    id: String(row.id), status: String(row.status) as AvailabilityStatus, archiveOutcome: row.archive_outcome ? String(row.archive_outcome) as ArchiveOutcome : null, name: String(row.name), email: String(row.email),
    arrivalDate: date(row.arrival_date), departureDate: date(row.departure_date), guestCount: Number(row.guest_count),
    message: String(row.message ?? ""), language: String(row.language), quoteAmountCents: row.quote_amount_cents == null ? null : Number(row.quote_amount_cents), quoteSubject: row.quote_subject == null ? null : String(row.quote_subject), quoteBody: row.quote_body == null ? null : String(row.quote_body), quoteSentAt: row.quote_sent_at == null ? null : iso(row.quote_sent_at), privacyAcceptedAt: iso(row.privacy_accepted_at),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  };
}
