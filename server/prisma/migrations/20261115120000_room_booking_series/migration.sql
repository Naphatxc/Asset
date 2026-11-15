-- AlterTable
ALTER TABLE `room_bookings` ADD COLUMN `series_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `idx_room_bookings_series` ON `room_bookings`(`series_id`);
