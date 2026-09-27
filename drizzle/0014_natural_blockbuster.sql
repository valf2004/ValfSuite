CREATE TABLE `checkin_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`guest_ordinal` integer DEFAULT 0 NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `availability_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_checkin_documents_request_created` ON `checkin_documents` (`request_id`,`created_at`);