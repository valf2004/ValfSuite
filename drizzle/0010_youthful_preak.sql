CREATE TABLE `alloggiati_lookup_values` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`item_key` text NOT NULL,
	`item_value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_alloggiati_lookup_table_key` ON `alloggiati_lookup_values` (`table_name`,`item_key`);--> statement-breakpoint
CREATE INDEX `idx_alloggiati_lookup_table` ON `alloggiati_lookup_values` (`table_name`);