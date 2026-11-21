CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `desiccant_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`storage_location_id` integer NOT NULL,
	`replaced_at` text DEFAULT (current_timestamp) NOT NULL,
	`note` text,
	FOREIGN KEY (`storage_location_id`) REFERENCES `storage_locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dry_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filament_id` integer NOT NULL,
	`dried_at` text DEFAULT (current_timestamp) NOT NULL,
	`temperature_c` integer,
	`duration_min` integer,
	`note` text,
	FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `filament_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manufacturer` text NOT NULL,
	`product_name` text NOT NULL,
	`material` text NOT NULL,
	`diameter` real DEFAULT 1.75 NOT NULL,
	`spool_weight_g` integer DEFAULT 250 NOT NULL,
	`nozzle_temp_c` integer,
	`bed_temp_c` integer,
	`speed_mms` integer,
	`fan_percent` integer,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `filaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`color_name` text NOT NULL,
	`color_hex` text NOT NULL,
	`nominal_weight_g` integer DEFAULT 1000 NOT NULL,
	`registered_weight_g` integer NOT NULL,
	`current_weight_g` integer NOT NULL,
	`price_yen` integer NOT NULL,
	`purchased_at` text,
	`purchased_from` text,
	`opened_at` text,
	`storage_location_id` integer,
	`status` text DEFAULT 'unopened' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `filament_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `print_job_filaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`print_job_id` integer NOT NULL,
	`filament_id` integer NOT NULL,
	`used_weight_g` integer NOT NULL,
	`cost_yen` integer NOT NULL,
	FOREIGN KEY (`print_job_id`) REFERENCES `print_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_name` text,
	`printed_at` text DEFAULT (current_timestamp) NOT NULL,
	`duration_min` integer,
	`result` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`replace_interval_days` integer DEFAULT 60 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filament_id` integer NOT NULL,
	`method` text NOT NULL,
	`value_g` integer NOT NULL,
	`resulting_weight_g` integer NOT NULL,
	`adjusted_at` text DEFAULT (current_timestamp) NOT NULL,
	`note` text,
	FOREIGN KEY (`filament_id`) REFERENCES `filaments`(`id`) ON UPDATE no action ON DELETE no action
);
