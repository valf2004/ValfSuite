ALTER TABLE `checkin_guests` ADD `residence_country_code` text;--> statement-breakpoint
ALTER TABLE `checkin_guests` ADD `residence_place_code` text;--> statement-breakpoint
ALTER TABLE `checkin_practices` ADD `tourism_type` text DEFAULT 'NON SPECIFICATO' NOT NULL;