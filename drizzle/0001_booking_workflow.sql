ALTER TABLE `availability_requests` ADD `archive_outcome` text;
--> statement-breakpoint
UPDATE `availability_requests` SET `status` = CASE WHEN `status`='new' THEN 'quote_requested' WHEN `status`='contacted' THEN 'quote_sent' WHEN `status`='confirmed' THEN 'accepted' WHEN `status`='declined' THEN 'archived' ELSE `status` END;
--> statement-breakpoint
UPDATE `availability_requests` SET `archive_outcome`='unavailable' WHERE `status`='archived' AND `archive_outcome` IS NULL;
