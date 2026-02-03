-- CreateTable
CREATE TABLE `FBSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `cookie` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `c_user` VARCHAR(191) NULL,
    `user_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verified_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `scheduled_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `image_url` VARCHAR(191) NULL,
    `page_name` VARCHAR(191) NOT NULL,
    `page_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `session_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `FBSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
