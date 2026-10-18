-- CreateTable
CREATE TABLE `rooms` (
    `room_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uq_room_name`(`room_name`),
    PRIMARY KEY (`room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_bookings` (
    `booking_id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER UNSIGNED NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `start_at` DATETIME(0) NOT NULL,
    `end_at` DATETIME(0) NOT NULL,
    `purpose` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_room_bookings_room_start`(`room_id`, `start_at`),
    INDEX `fk_room_booking_user`(`user_id`),
    PRIMARY KEY (`booking_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `room_bookings` ADD CONSTRAINT `fk_room_booking_room` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`room_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `room_bookings` ADD CONSTRAINT `fk_room_booking_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;


-- ห้องเริ่มต้น 5 ห้องตามที่อาจารย์กำหนด ชื่อเป็นชื่อชั่วคราว Admin แก้เป็นชื่อจริงได้จากหน้าจัดการห้อง
INSERT INTO `rooms` (`room_name`) VALUES ('ห้อง 1'), ('ห้อง 2'), ('ห้อง 3'), ('ห้อง 4'), ('ห้อง 5');
