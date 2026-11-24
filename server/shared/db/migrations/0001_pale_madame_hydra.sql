PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`dataset_id` text NOT NULL,
	`name` text NOT NULL,
	`owner_id` text,
	`visibility` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "configurations_name_length" CHECK(length("__new_configurations"."name") BETWEEN 1 AND 100),
	CONSTRAINT "configurations_owner_matches_visibility" CHECK(("__new_configurations"."visibility" = 'system') = ("__new_configurations"."owner_id" IS NULL)),
	CONSTRAINT "configurations_default_is_system" CHECK("__new_configurations"."is_default" = 0 OR "__new_configurations"."visibility" = 'system')
);
--> statement-breakpoint
INSERT INTO `__new_configurations`("id", "dataset_id", "name", "owner_id", "visibility", "is_default", "config", "created_at") SELECT "id", "dataset_id", "name", "owner_id", "visibility", "is_default", "config", "created_at" FROM `configurations`;--> statement-breakpoint
DROP TABLE `configurations`;--> statement-breakpoint
ALTER TABLE `__new_configurations` RENAME TO `configurations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ux_configurations_default` ON `configurations` (`dataset_id`) WHERE "configurations"."is_default" = 1;--> statement-breakpoint
CREATE INDEX `ix_configurations_dataset` ON `configurations` (`dataset_id`,`visibility`,`owner_id`);