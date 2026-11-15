-- CreateTable
CREATE TABLE `document_submissions` (
    `submission_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `doc_type` ENUM('idp', 'obe3', 'obe5') NOT NULL,
    `academic_year` SMALLINT UNSIGNED NOT NULL,
    `note` TEXT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `file_type` VARCHAR(100) NOT NULL,
    `submitted_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` ENUM('pending', 'approved', 'returned') NULL,
    `reviewed_by` INTEGER UNSIGNED NULL,
    `reviewed_at` DATETIME(0) NULL,
    `review_note` TEXT NULL,
    `review_file_name` VARCHAR(255) NULL,
    `review_file_path` VARCHAR(255) NULL,
    `review_file_type` VARCHAR(100) NULL,

    INDEX `idx_document_submissions_user`(`user_id`),
    INDEX `idx_document_submissions_type_status`(`doc_type`, `status`),
    INDEX `fk_document_submission_reviewer`(`reviewed_by`),
    PRIMARY KEY (`submission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `document_submissions` ADD CONSTRAINT `fk_document_submission_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `document_submissions` ADD CONSTRAINT `fk_document_submission_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
