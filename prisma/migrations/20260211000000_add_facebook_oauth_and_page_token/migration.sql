-- AlterTable
ALTER TABLE `FBSession` ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'cookie',
    ADD COLUMN `oauth_access_token` TEXT NULL,
    ADD COLUMN `oauth_fb_user_id` VARCHAR(191) NULL,
    ADD COLUMN `oauth_token_expires_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `FBPage` ADD COLUMN `page_access_token` TEXT NULL;
