-- AlterTable
ALTER TABLE `equipment_items` MODIFY `status` ENUM('available', 'borrowed', 'pending_repair', 'repairing', 'disposed', 'damaged') NOT NULL DEFAULT 'available';

-- AlterTable
ALTER TABLE `audit_records` ADD COLUMN `marked_damaged` BOOLEAN NOT NULL DEFAULT false;
