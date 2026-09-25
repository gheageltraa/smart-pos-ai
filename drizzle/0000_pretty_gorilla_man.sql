CREATE TABLE `outletMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`outletId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('manager','cashier') NOT NULL DEFAULT 'cashier',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outletMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `outlet_member_unique` UNIQUE(`outletId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `outlets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`code` varchar(32) NOT NULL,
	`city` varchar(96) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outlets_id` PRIMARY KEY(`id`),
	CONSTRAINT `outlets_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
