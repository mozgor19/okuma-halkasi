ALTER TABLE `attendance` ADD `current_page` integer;
--> statement-breakpoint
ALTER TABLE `members` ADD `is_guest` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `members` ADD `guest_meeting_id` integer;
--> statement-breakpoint
ALTER TABLE `meetings` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `roadmap` ADD `deleted_at` text;
--> statement-breakpoint
CREATE TABLE `book_votes` (
	`member_id` integer PRIMARY KEY NOT NULL,
	`roadmap_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roadmap_id`) REFERENCES `roadmap`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `club_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `club_settings` (`key`, `value`) VALUES ('book_vote_visibility', 'open');
