CREATE TABLE `availability_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`arrival_date` text NOT NULL,
	`departure_date` text NOT NULL,
	`guest_count` integer NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'it' NOT NULL,
	`privacy_accepted_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_availability_requests_status_created` ON `availability_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_availability_requests_arrival` ON `availability_requests` (`arrival_date`);