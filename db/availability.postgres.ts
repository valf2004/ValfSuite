import postgres, { type Sql } from "postgres";
import { availabilityRequests } from "./schema";

export type AvailabilityStatus = "new" | "contacted" | "confirmed" | "declined" | "archived";
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
    (id,status,name,email,arrival_date,departure_date,guest_count,message,language,privacy_accepted_at,created_at,updated_at)
    VALUES (${record.id},${record.status ?? "new"},${record.name},${record.email},${record.arrivalDate},${record.departureDate},${record.guestCount},${record.message ?? ""},${record.language ?? "it"},${record.privacyAcceptedAt},${record.createdAt},${record.updatedAt})`;
}

export async function listAvailabilityRequests(status?: AvailabilityStatus) {
  await ready();
  const rows = status ? await sql`SELECT * FROM availability_requests WHERE status=${status} ORDER BY created_at DESC` : await sql`SELECT * FROM availability_requests ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function updateAvailabilityStatus(id: string, status: AvailabilityStatus) {
  await ready();
  const rows = await sql`UPDATE availability_requests SET status=${status},updated_at=${new Date().toISOString()} WHERE id=${id} RETURNING *`;
  return rows.map(mapRow);
}

async function initializePostgres(client: Sql) {
  await client`CREATE TABLE IF NOT EXISTS availability_requests (
    id text PRIMARY KEY,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','declined','archived')),
    name text NOT NULL,email text NOT NULL,arrival_date date NOT NULL,departure_date date NOT NULL,
    guest_count integer NOT NULL CHECK (guest_count BETWEEN 1 AND 4),message text NOT NULL DEFAULT '',language text NOT NULL DEFAULT 'it',
    privacy_accepted_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (departure_date > arrival_date))`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_requests_status_created ON availability_requests (status,created_at DESC)`;
  await client`CREATE INDEX IF NOT EXISTS idx_availability_requests_arrival ON availability_requests (arrival_date)`;
}

function mapRow(row: Record<string, unknown>): AvailabilityRecord {
  const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);
  const date=(value:unknown)=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
  return {id:String(row.id),status:String(row.status) as AvailabilityStatus,name:String(row.name),email:String(row.email),arrivalDate:date(row.arrival_date),departureDate:date(row.departure_date),guestCount:Number(row.guest_count),message:String(row.message??""),language:String(row.language),privacyAcceptedAt:iso(row.privacy_accepted_at),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)};
}
