CREATE TABLE `favorite_books` (
	`member_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`member_id`, `book_id`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `meetings` ADD `reading_scope` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `book_status` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `avatar_media_key` text;