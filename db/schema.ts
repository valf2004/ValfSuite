import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const availabilityRequests = sqliteTable("availability_requests", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["quote_requested", "quote_sent", "accepted", "checked_in", "police_registered", "archived"] }).notNull().default("quote_requested"),
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
