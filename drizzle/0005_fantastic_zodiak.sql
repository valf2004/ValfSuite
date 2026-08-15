ALTER TABLE `availability_requests` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;
--> statement-breakpoint
UPDATE `availability_requests`
SET `payment_status` = 'reported'
WHERE `status` = 'payment_reported';
--> statement-breakpoint
UPDATE `availability_requests`
SET `status` = COALESCE(
  (
    SELECT `from_status`
    FROM `availability_events`
    WHERE `request_id` = `availability_requests`.`id`
      AND `event_type` = 'payment_reported'
      AND `from_status` IS NOT NULL
      AND `from_status` <> 'payment_reported'
    ORDER BY `created_at` DESC
    LIMIT 1
  ),
  'quote_sent'
)
WHERE `status` = 'payment_reported';
--> statement-breakpoint
UPDATE `availability_requests`
SET `payment_status` = 'paid'
WHERE `payment_status` = 'unpaid'
  AND `quote_amount_cents` IS NOT NULL
  AND COALESCE(
    (
      SELECT SUM(`amount_cents`)
      FROM `availability_events`
      WHERE `request_id` = `availability_requests`.`id`
        AND `event_type` = 'payment_confirmed'
    ),
    0
  ) >= `quote_amount_cents`;
--> statement-breakpoint
UPDATE `availability_requests`
SET `payment_status` = 'partial'
WHERE `payment_status` = 'unpaid'
  AND COALESCE(
    (
      SELECT SUM(`amount_cents`)
      FROM `availability_events`
      WHERE `request_id` = `availability_requests`.`id`
        AND `event_type` = 'payment_confirmed'
    ),
    0
  ) > 0;
