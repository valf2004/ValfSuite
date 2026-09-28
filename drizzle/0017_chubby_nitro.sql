CREATE TABLE `alloggiati_receipts` (
	`receipt_date` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text DEFAULT 'application/pdf' NOT NULL,
	`size` integer NOT NULL,
	`archived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
