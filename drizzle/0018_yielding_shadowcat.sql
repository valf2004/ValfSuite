CREATE TABLE `alloggiati_receipt_links` (
	`request_id` text PRIMARY KEY NOT NULL,
	`receipt_date` text NOT NULL,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `availability_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receipt_date`) REFERENCES `alloggiati_receipts`(`receipt_date`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_alloggiati_receipt_links_date` ON `alloggiati_receipt_links` (`receipt_date`);