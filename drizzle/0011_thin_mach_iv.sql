CREATE TABLE `checkin_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`alloggiati_type` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`sex_code` text NOT NULL,
	`citizenship_code` text NOT NULL,
	`birth_country_code` text NOT NULL,
	`birth_place_code` text,
	`document_type_code` text,
	`document_number` text,
	`issue_place_code` text,
	FOREIGN KEY (`request_id`) REFERENCES `checkin_practices`(`request_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_checkin_guests_request_ordinal` ON `checkin_guests` (`request_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `idx_checkin_guests_request` ON `checkin_guests` (`request_id`);--> statement-breakpoint
CREATE TABLE `checkin_practices` (
	`request_id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`language` text DEFAULT 'it' NOT NULL,
	`guest_count` integer NOT NULL,
	`group_type` text NOT NULL,
	`arrival_time` text NOT NULL,
	`transport` text NOT NULL,
	`arrival_notes` text DEFAULT '' NOT NULL,
	`privacy_accepted_at` text NOT NULL,
	`source` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_error` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `availability_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `alloggiati_lookup_values` ADD `metadata_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `alloggiati_lookup_values` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `alloggiati_lookup_values` ADD `synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;