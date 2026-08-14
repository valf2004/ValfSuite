CREATE TABLE `availability_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor_email` text,
	`note` text,
	`subject` text,
	`body` text,
	`amount_cents` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `availability_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_availability_events_request_created` ON `availability_events` (`request_id`,`created_at`);
