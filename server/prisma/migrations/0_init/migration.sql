-- CreateTable
CREATE TABLE `categories` (
    `category_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `code_prefix` VARCHAR(20) NULL,

    UNIQUE INDEX `category_name`(`category_name`),
    UNIQUE INDEX `categories_code_prefix`(`code_prefix`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment` (
    `equipment_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `equipment_name` VARCHAR(255) NOT NULL,
    `category_id` INTEGER UNSIGNED NOT NULL,
    `location_id` INTEGER UNSIGNED NULL,
    `fiscal_year` YEAR NULL,
    `description` TEXT NULL,
    `receive_date` DATE NULL,
    `remark` TEXT NULL,

    INDEX `fk_equipment_category`(`category_id`),
    INDEX `fk_equipment_location`(`location_id`),
    PRIMARY KEY (`equipment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_history` (
    `history_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER UNSIGNED NOT NULL,
    `action` ENUM('created', 'updated', 'status_changed', 'deleted', 'restored') NOT NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `changed_by` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_equipment_history_changed_by`(`changed_by`),
    INDEX `idx_equipment_history_item`(`item_id`),
    PRIMARY KEY (`history_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_items` (
    `item_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `equipment_id` INTEGER UNSIGNED NOT NULL,
    `equipment_name` VARCHAR(255) NOT NULL,
    `equipment_code` VARCHAR(50) NOT NULL,
    `status` ENUM('available', 'borrowed', 'pending_repair', 'repairing') NOT NULL DEFAULT 'available',
    `price` DECIMAL(10, 2) NULL,
    `warranty_expire` DATE NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `equipment_code`(`equipment_code`),
    INDEX `fk_item_equipment`(`equipment_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `location_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `location_name` VARCHAR(100) NOT NULL,
    `building` VARCHAR(100) NULL,
    `room` VARCHAR(30) NULL,

    PRIMARY KEY (`location_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `material_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `material_code` VARCHAR(50) NOT NULL,
    `material_name` VARCHAR(150) NOT NULL,
    `category_id` INTEGER UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `minimum_quantity` INTEGER NOT NULL DEFAULT 0,
    `expire_date` DATE NULL,
    `unit_name` VARCHAR(50) NOT NULL,
    `unit_price` DECIMAL(10, 2) NULL,
    `remark` TEXT NULL,
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `material_code`(`material_code`),
    INDEX `fk_material_category`(`category_id`),
    PRIMARY KEY (`material_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_withdrawals` (
    `withdrawal_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `material_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,
    `remark` TEXT NULL,
    `withdrawn_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_withdrawals_material`(`material_id`),
    INDEX `idx_withdrawals_user`(`user_id`),
    PRIMARY KEY (`withdrawal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `borrow_details` (
    `borrow_detail_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `borrow_id` INTEGER UNSIGNED NOT NULL,
    `item_id` INTEGER UNSIGNED NOT NULL,
    `return_date` DATETIME(0) NOT NULL,
    `return_requested_at` DATETIME(0) NULL,
    `returned_at` DATETIME(0) NULL,

    INDEX `idx_borrow_details_borrow`(`borrow_id`),
    INDEX `idx_borrow_details_item`(`item_id`),
    PRIMARY KEY (`borrow_detail_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `borrows` (
    `borrow_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `borrow_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `remark` TEXT NULL,

    INDEX `fk_borrow_user`(`user_id`),
    PRIMARY KEY (`borrow_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repair_files` (
    `file_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `repair_id` INTEGER UNSIGNED NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(100) NULL,

    INDEX `idx_repair_files_repair`(`repair_id`),
    PRIMARY KEY (`file_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repairs` (
    `repair_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER UNSIGNED NOT NULL,
    `reported_by` INTEGER UNSIGNED NOT NULL,
    `issue` TEXT NOT NULL,
    `repair_detail` TEXT NULL,
    `repair_cost` DECIMAL(10, 2) NULL,
    `repair_date` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` ENUM('pending_repair', 'repairing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_repair',

    INDEX `fk_repair_user`(`reported_by`),
    INDEX `idx_repairs_item`(`item_id`),
    PRIMARY KEY (`repair_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `equipment` ADD CONSTRAINT `fk_equipment_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `equipment` ADD CONSTRAINT `fk_equipment_location` FOREIGN KEY (`location_id`) REFERENCES `locations`(`location_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `equipment_history` ADD CONSTRAINT `fk_history_item` FOREIGN KEY (`item_id`) REFERENCES `equipment_items`(`item_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `equipment_history` ADD CONSTRAINT `fk_history_user` FOREIGN KEY (`changed_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `equipment_items` ADD CONSTRAINT `fk_item_equipment` FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`equipment_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `fk_material_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_withdrawals` ADD CONSTRAINT `fk_withdrawal_material` FOREIGN KEY (`material_id`) REFERENCES `materials`(`material_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_withdrawals` ADD CONSTRAINT `fk_withdrawal_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `borrow_details` ADD CONSTRAINT `fk_borrow_detail_borrow` FOREIGN KEY (`borrow_id`) REFERENCES `borrows`(`borrow_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `borrow_details` ADD CONSTRAINT `fk_borrow_detail_item` FOREIGN KEY (`item_id`) REFERENCES `equipment_items`(`item_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `borrows` ADD CONSTRAINT `fk_borrow_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `repair_files` ADD CONSTRAINT `fk_repair_file_repair` FOREIGN KEY (`repair_id`) REFERENCES `repairs`(`repair_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `repairs` ADD CONSTRAINT `fk_repair_item` FOREIGN KEY (`item_id`) REFERENCES `equipment_items`(`item_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `repairs` ADD CONSTRAINT `fk_repair_user` FOREIGN KEY (`reported_by`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddCheckConstraint
-- เขียนเองเพราะ Prisma ยังไม่รองรับ check constraint จึงไม่ถูก generate ออกมาจาก schema.prisma
-- ถ้าไม่มีบรรทัดนี้ ฐานข้อมูลที่สร้างใหม่จาก migration จะเพี้ยนจาก production ที่มี constraint นี้อยู่
ALTER TABLE `materials` ADD CONSTRAINT `chk_material_quantity` CHECK (`quantity` >= 0);

