-- CreateTable
CREATE TABLE `notification_settings` (
    `event_key` VARCHAR(40) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `recipient_mode` ENUM('requester', 'all_admins', 'selected_admins') NOT NULL DEFAULT 'requester',
    `extra_emails` TEXT NULL,
    `subject_template` VARCHAR(200) NULL,
    `body_template` TEXT NULL,
    `updated_by` INTEGER UNSIGNED NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_notification_setting_updated_by`(`updated_by`),
    PRIMARY KEY (`event_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_setting_admins` (
    `event_key` VARCHAR(40) NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,

    INDEX `fk_notification_admin_user`(`user_id`),
    PRIMARY KEY (`event_key`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_settings` ADD CONSTRAINT `fk_notification_setting_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification_setting_admins` ADD CONSTRAINT `fk_notification_admin_setting` FOREIGN KEY (`event_key`) REFERENCES `notification_settings`(`event_key`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notification_setting_admins` ADD CONSTRAINT `fk_notification_admin_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE NO ACTION;
