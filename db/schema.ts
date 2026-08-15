import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const availabilityRequests = sqliteTable("availability_requests", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["quote_requested", "quote_sent", "payment_reported", "accepted", "checked_in", "police_registered", "archived"] }).notNull().default("quote_requested"),
  archiveOutcome: text("archive_outcome", { enum: ["completed", "cancelled", "unavailable"] }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  arrivalDate: text("arrival_date").notNull(),
  departureDate: text("departure_date").notNull(),
  guestCount: integer("guest_count").notNull(),
  message: text("message").notNull().default(""),
  language: text("language").notNull().default("it"),
  quoteAmountCents: integer("quote_amount_cents"),
  quoteSubject: text("quote_subject"),
  quoteBody: text("quote_body"),
  quoteSentAt: text("quote_sent_at"),
  privacyAcceptedAt: text("privacy_accepted_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_availability_requests_status_created").on(table.status, table.createdAt),
  index("idx_availability_requests_arrival").on(table.arrivalDate),
]);

export const availabilityEvents = sqliteTable("availability_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => availabilityRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["request_created", "email_sent", "payment_reported", "payment_confirmed", "status_changed"] }).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorEmail: text("actor_email"),
  note: text("note"),
  subject: text("subject"),
  body: text("body"),
  amountCents: integer("amount_cents"),
  attachmentId: text("attachment_id"),
  attachmentName: text("attachment_name"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_availability_events_request_created").on(table.requestId, table.createdAt),
]);

export const availabilityQuotes = sqliteTable("availability_quotes", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => availabilityRequests.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  tokenHash: text("token_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_availability_quotes_token_hash").on(table.tokenHash),
  index("idx_availability_quotes_request_active").on(table.requestId, table.active),
]);

export const paymentSubmissions = sqliteTable("payment_submissions", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => availabilityQuotes.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull().references(() => availabilityRequests.id, { onDelete: "cascade" }),
  method: text("method", { enum: ["bank_transfer", "paypal"] }).notNull(),
  paidAmountCents: integer("paid_amount_cents").notNull(),
  paidAt: text("paid_at").notNull(),
  paymentReference: text("payment_reference").notNull().default(""),
  message: text("message").notNull().default(""),
  receiptKey: text("receipt_key"),
  receiptName: text("receipt_name"),
  receiptContentType: text("receipt_content_type"),
  receiptSize: integer("receipt_size"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_payment_submissions_request_created").on(table.requestId, table.createdAt),
  index("idx_payment_submissions_quote").on(table.quoteId),
]);
