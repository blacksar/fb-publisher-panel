-- CreateEnum (MySQL: no native enum for Prisma, we use VARCHAR)
-- CreateTable User
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable FBSession: add userId
ALTER TABLE `FBSession` ADD COLUMN `userId` VARCHAR(191) NULL;

-- AlterTable Post: add userId
ALTER TABLE `Post` ADD COLUMN `userId` VARCHAR(191) NULL;

-- AlterTable Setting: add id and userId, then change PK
ALTER TABLE `Setting` ADD COLUMN `id` VARCHAR(191) NULL,
    ADD COLUMN `userId` VARCHAR(191) NULL;

-- Backfill id for existing rows (unique per row using key + timestamp)
UPDATE `Setting` SET `id` = CONCAT('cl', SUBSTRING(MD5(CONCAT(`key`, COALESCE(`value`, ''), RAND())), 1, 24)) WHERE `id` IS NULL;

ALTER TABLE `Setting` MODIFY COLUMN `id` VARCHAR(191) NOT NULL;

ALTER TABLE `Setting` DROP PRIMARY KEY;

ALTER TABLE `Setting` ADD PRIMARY KEY (`id`);

CREATE UNIQUE INDEX `Setting_userId_key_key` ON `Setting`(`userId`, `key`);

-- AddForeignKey User.createdBy
ALTER TABLE `User` ADD CONSTRAINT `User_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey FBSession.user
ALTER TABLE `FBSession` ADD CONSTRAINT `FBSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Post.user
ALTER TABLE `Post` ADD CONSTRAINT `Post_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Setting.user
ALTER TABLE `Setting` ADD CONSTRAINT `Setting_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
