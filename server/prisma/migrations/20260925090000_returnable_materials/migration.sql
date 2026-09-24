-- AlterTable
ALTER TABLE `materials` ADD COLUMN `is_returnable` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `material_withdrawals` ADD COLUMN `due_date` DATE NULL,
    ADD COLUMN `returned_at` DATETIME(0) NULL,
    ADD COLUMN `returned_quantity` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `material_returns` (
    `return_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `withdrawal_id` INTEGER UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,
    `remark` TEXT NULL,
    `returned_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `received_by` INTEGER UNSIGNED NOT NULL,

    INDEX `idx_material_returns_withdrawal`(`withdrawal_id`),
    INDEX `idx_material_returns_user`(`received_by`),
    PRIMARY KEY (`return_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `material_returns` ADD CONSTRAINT `fk_material_return_withdrawal` FOREIGN KEY (`withdrawal_id`) REFERENCES `material_withdrawals`(`withdrawal_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_returns` ADD CONSTRAINT `fk_material_return_user` FOREIGN KEY (`received_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

