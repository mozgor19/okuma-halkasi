ALTER TABLE `members` ADD `face_reference_media_key` text;
--> statement-breakpoint
ALTER TABLE `members` ADD `face_recognition_consent` integer DEFAULT 0 NOT NULL;
