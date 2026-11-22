CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ix_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text NOT NULL,
	`name` text NOT NULL,
	`owner_id` text,
	`visibility` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "configurations_name_length" CHECK(length("configurations"."name") BETWEEN 1 AND 100),
	CONSTRAINT "configurations_owner_matches_visibility" CHECK(("configurations"."visibility" = 'system') = ("configurations"."owner_id" IS NULL)),
	CONSTRAINT "configurations_default_is_system" CHECK("configurations"."is_default" = 0 OR "configurations"."visibility" = 'system'),
	CONSTRAINT "configurations_published_at_matches_visibility" CHECK(("configurations"."visibility" = 'public') = ("configurations"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_configurations_default` ON `configurations` (`dataset_id`) WHERE "configurations"."is_default" = 1;--> statement-breakpoint
CREATE INDEX `ix_configurations_dataset` ON `configurations` (`dataset_id`,`visibility`,`owner_id`);