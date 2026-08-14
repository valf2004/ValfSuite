ALTER TABLE `availability_requests` ADD `quote_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `availability_requests` ADD `quote_subject` text;
--> statement-breakpoint
ALTER TABLE `availability_requests` ADD `quote_body` text;
--> statement-breakpoint
ALTER TABLE `availability_requests` ADD `quote_sent_at` text;
