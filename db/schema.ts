import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// Tabella conservata per compatibilità con la migrazione 0009; la configurazione corrente vive nel file .env.
export const applicationSettings = sqliteTable("application_settings", {
  key: text("key").primaryKey(),
  encryptedValue: text("encrypted_value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull(),
});

export const alloggiatiLookupValues = sqliteTable("alloggiati_lookup_values", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  itemKey: text("item_key").notNull(),
  itemValue: text("item_value").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_alloggiati_lookup_table_key").on(table.tableName, table.itemKey),
  index("idx_alloggiati_lookup_table").on(table.tableName),
]);

export const availabilityRequests = sqliteTable("availability_requests", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["quote_requested", "quote_sent", "accepted", "checked_in", "police_registered", "archived"] }).notNull().default("quote_requested"),
  paymentStatus: text("payment_status", { enum: ["unpaid", "reported", "partial", "paid"] }).notNull().default("unpaid"),
  archiveOutcome: text("archive_outcome", { enum: ["completed", "cancelled", "unavailable"] }),
  sourceRequestId: text("source_request_id"),
  relationReason: text("relation_reason", { enum: ["new_stay", "stay_change"] }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  arrivalDate: text("arrival_date").notNull(),
  departureDate: text("departure_date").notNull(),
  guestCount: integer("guest_count").notNull(),
  message: text("message").notNull().default(""),
  language: text("language").notNull().default("it"),
  quoteAmountCents: integer("quote_amount_cents"),
  quoteRequestedPaymentCents: integer("quote_requested_payment_cents"),
  quoteDepositPercent: integer("quote_deposit_percent"),
  quoteBalancePercent: integer("quote_balance_percent"),
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

export const checkinPractices = sqliteTable("checkin_practices", {
  requestId: text("request_id").primaryKey().references(() => availabilityRequests.id, { onDelete: "cascade" }),
  state: text("state", { enum: ["draft", "ready", "validated", "sent", "error"] }).notNull().default("draft"),
  language: text("language").notNull().default("it"),
  guestCount: integer("guest_count").notNull(),
  groupType: text("group_type", { enum: ["single", "family", "group"] }).notNull(),
  arrivalTime: text("arrival_time").notNull(),
  transport: text("transport").notNull(),
  arrivalNotes: text("arrival_notes").notNull().default(""),
  privacyAcceptedAt: text("privacy_accepted_at").notNull(),
  source: text("source", { enum: ["guest", "operator"] }).notNull(),
  version: integer("version").notNull().default(1),
  lastError: text("last_error"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const checkinGuests = sqliteTable("checkin_guests", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => checkinPractices.requestId, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  alloggiatiType: text("alloggiati_type").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: text("birth_date").notNull(),
  sexCode: text("sex_code").notNull(),
  citizenshipCode: text("citizenship_code").notNull(),
  birthCountryCode: text("birth_country_code").notNull(),
  birthPlaceCode: text("birth_place_code"),
  documentTypeCode: text("document_type_code"),
  documentNumber: text("document_number"),
  issuePlaceCode: text("issue_place_code"),
}, (table) => [
  uniqueIndex("idx_checkin_guests_request_ordinal").on(table.requestId, table.ordinal),
  index("idx_checkin_guests_request").on(table.requestId),
]);

export const availabilityEvents = sqliteTable("availability_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().references(() => availabilityRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["request_created", "related_request_created", "email_sent", "payment_reported", "payment_confirmed", "balance_requested", "checkin_invited", "checkin_submitted", "checkin_updated", "status_changed"] }).notNull(),
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
  requestedPaymentCents: integer("requested_payment_cents"),
  depositPercent: integer("deposit_percent"),
  balancePercent: integer("balance_percent"),
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
