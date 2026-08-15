ALTER TABLE `availability_events` ADD `attachment_id` text;
--> statement-breakpoint
ALTER TABLE `availability_events` ADD `attachment_name` text;
--> statement-breakpoint
CREATE TABLE `availability_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`token_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `availability_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_availability_quotes_token_hash` ON `availability_quotes` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_availability_quotes_request_active` ON `availability_quotes` (`request_id`,`active`);
--> statement-breakpoint
CREATE TABLE `payment_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`request_id` text NOT NULL,
	`method` text NOT NULL,
	`paid_amount_cents` integer NOT NULL,
	`paid_at` text NOT NULL,
	`payment_reference` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`receipt_key` text,
	`receipt_name` text,
	`receipt_content_type` text,
	`receipt_size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `availability_quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `availability_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_payment_submissions_request_created` ON `payment_submissions` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_payment_submissions_quote` ON `payment_submissions` (`quote_id`);
