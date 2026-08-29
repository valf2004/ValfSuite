ALTER TABLE `availability_quotes` ADD `deposit_percent` integer;--> statement-breakpoint
ALTER TABLE `availability_quotes` ADD `balance_percent` integer;--> statement-breakpoint
ALTER TABLE `availability_requests` ADD `quote_deposit_percent` integer;--> statement-breakpoint
ALTER TABLE `availability_requests` ADD `quote_balance_percent` integer;