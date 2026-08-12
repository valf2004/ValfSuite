import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const availabilityRequests = sqliteTable("availability_requests", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["new", "contacted", "confirmed", "declined", "archived"] }).notNull().default("new"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  arrivalDate: text("arrival_date").notNull(),
  departureDate: text("departure_date").notNull(),
  guestCount: integer("guest_count").notNull(),
  message: text("message").notNull().default(""),
  language: text("language").notNull().default("it"),
  privacyAcceptedAt: text("privacy_accepted_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_availability_requests_status_created").on(table.status, table.createdAt),
  index("idx_availability_requests_arrival").on(table.arrivalDate),
]);
