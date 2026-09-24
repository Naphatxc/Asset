-- CreateTable
CREATE TABLE `audit_rounds` (
    `round_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(100) NOT NULL,
    `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    `opened_by` INTEGER UNSIGNED NOT NULL,
    `opened_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `closed_by` INTEGER UNSIGNED NULL,
    `closed_at` DATETIME(0) NULL,

    INDEX `fk_audit_round_opened_by`(`opened_by`),
    INDEX `fk_audit_round_closed_by`(`closed_by`),
    PRIMARY KEY (`round_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_records` (
    `record_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `round_id` INTEGER UNSIGNED NOT NULL,
    `item_id` INTEGER UNSIGNED NOT NULL,
    `expected_location_id` INTEGER UNSIGNED NULL,
    `result` ENUM('normal', 'damaged') NULL,
    `note` TEXT NULL,
    `found_location_id` INTEGER UNSIGNED NULL,
    `location_moved` BOOLEAN NOT NULL DEFAULT false,
    `moved_from_location_id` INTEGER UNSIGNED NULL,
    `repair_id` INTEGER UNSIGNED NULL,
    `checked_by` INTEGER UNSIGNED NULL,
    `checked_at` DATETIME(0) NULL,

    INDEX `fk_audit_record_item`(`item_id`),
    INDEX `fk_audit_record_expected_location`(`expected_location_id`),
    INDEX `fk_audit_record_found_location`(`found_location_id`),
    INDEX `fk_audit_record_moved_from_location`(`moved_from_location_id`),
    INDEX `fk_audit_record_repair`(`repair_id`),
    INDEX `fk_audit_record_checked_by`(`checked_by`),
    UNIQUE INDEX `uq_audit_record_round_item`(`round_id`, `item_id`),
    PRIMARY KEY (`record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_rounds` ADD CONSTRAINT `fk_audit_round_opened_by` FOREIGN KEY (`opened_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_rounds` ADD CONSTRAINT `fk_audit_round_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_round` FOREIGN KEY (`round_id`) REFERENCES `audit_rounds`(`round_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_item` FOREIGN KEY (`item_id`) REFERENCES `equipment_items`(`item_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_expected_location` FOREIGN KEY (`expected_location_id`) REFERENCES `locations`(`location_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_found_location` FOREIGN KEY (`found_location_id`) REFERENCES `locations`(`location_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_moved_from_location` FOREIGN KEY (`moved_from_location_id`) REFERENCES `locations`(`location_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_repair` FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`repair_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_records` ADD CONSTRAINT `fk_audit_record_checked_by` FOREIGN KEY (`checked_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

