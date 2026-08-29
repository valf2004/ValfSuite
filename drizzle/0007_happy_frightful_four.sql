ALTER TABLE `availability_quotes` ADD `requested_payment_cents` integer;--> statement-breakpoint
ALTER TABLE `availability_requests` ADD `quote_requested_payment_cents` integer;