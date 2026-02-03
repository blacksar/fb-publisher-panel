-- CreateTable
CREATE TABLE `FBPage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `postsCount` INTEGER NOT NULL DEFAULT 0,
    `isSyncing` BOOLEAN NOT NULL DEFAULT false,
    `session_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FBPage` ADD CONSTRAINT `FBPage_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `FBSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
